import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import {AssetService} from "./service";
import {OBJECT_ID, ObjectId} from "@spica/database";
import {Asset, Config, ExportMeta, Resource} from "@spica/interface";
import {exporters, operators, validators} from "./registration";
import {putConfiguration} from "./helpers";
import {BOOLEAN, DEFAULT, JSONP} from "@spica/core";
import {Schema} from "@spica/core";
import {ActionGuard, AuthGuard} from "@spica/api/src/passport/guard";
import {
  ASSET_REP_MANAGER,
  IInstallationStrategy,
  InstallationChanges,
  INSTALLATION_STRATEGIES
} from "./interface";
import {AssetRepManager} from "./representative";
import {createReadStream} from "fs";

@Controller("asset")
export class AssetController {
  constructor(
    private service: AssetService,
    @Inject(ASSET_REP_MANAGER) private repManager: AssetRepManager,
    @Inject(INSTALLATION_STRATEGIES) private installationStrategies: IInstallationStrategy[]
  ) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("asset:index"))
  find(@Query("filter", DEFAULT({}), JSONP) filter: object) {
    return this.service.find(filter);
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("asset:show", "asset"))
  async findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.service.findOne({_id: id}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
      return r;
    });
  }

  @Post()
  @UseGuards(AuthGuard(), ActionGuard("asset:download"))
  async insert(@Body(Schema.validate("http://spica.internal/asset")) asset: Asset) {
    asset.status = "downloaded";
    return this.service.insertOne(asset);
  }

  @Post("export")
  @UseGuards(AuthGuard(), ActionGuard("asset:export", "asset"))
  async export(
    @Body(Schema.validate("http://spica.internal/asset/export")) exportMeta: ExportMeta,
    //@ts-ignore
    @Res({passthrough: true}) res
  ) {
    await this.repManager.rm();

    for (const [module, resources] of Object.entries(exportMeta.resources)) {
      const relatedExporters = exporters.get(module);
      if (!relatedExporters || !relatedExporters.length) {
        return res.status(400).json({message: `Module ${module} does not exist.`});
      }

      const exports = relatedExporters.map(exporter =>
        Promise.all(
          resources.map(id =>
            exporter(id).catch(e => {
              return res
                .status(400)
                .json({message: `Failed to export asset for ${module} module.\n${e}`});
            })
          )
        )
      );
      await Promise.all(exports);
    }

    await this.repManager.putAssetMeta(exportMeta);

    const output = await this.repManager.zipAssets();
    const file = createReadStream(output);

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="asset.zip"'
    });

    file.pipe(res);
  }

  @Post(":id")
  @UseGuards(AuthGuard(), ActionGuard("asset:install", "asset"))
  async install(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(
      Schema.validate({
        type: "object",
        required: ["configs"],
        properties: {
          configs: {
            $ref: "http://spica.internal/asset/configs"
          }
        },
        additionalProperties: false
      })
    )
    {configs}: {configs: Config[]},
    @Query("preview", BOOLEAN) preview: boolean
  ) {
    let asset = await this.service.findOne({_id: id});
    if (!asset) {
      throw new NotFoundException();
    }

    asset = putConfiguration(asset, configs);

    await this.validateResources(asset.resources);

    const allVersions = await this.service.find({
      url: asset.url
    });

    const strategy = this.installationStrategies.find(s => s.isMyTask(asset, allVersions));

    let changes: InstallationChanges;

    try {
      changes = strategy.getChanges();
    } catch (error) {
      throw new BadRequestException(error.message || error);
    }

    if (preview) {
      return changes;
    }

    const resourcesAfterInstall: Resource[] = [];

    await Promise.all([
      this.operate(changes.insertions, "insert").then(r => resourcesAfterInstall.push(...r)),
      this.operate(changes.updations, "update").then(r => resourcesAfterInstall.push(...r)),
      this.operate(changes.deletions, "delete").then(r => resourcesAfterInstall.push(...r))
    ]);

    const assetsAfterInstall = strategy.afterInstall(resourcesAfterInstall);

    await Promise.all(assetsAfterInstall.map(a => this.service.findOneAndReplace({_id: a._id}, a)));

    return assetsAfterInstall.find(a => a._id == asset._id);
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("asset:delete", "asset"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Query("type") type: "soft" | "hard" = "soft"
  ) {
    const asset = await this.service.findOne({_id: id});

    if (asset.status != "downloaded") {
      await this.operate(
        asset.resources.filter(resource => resource.installation_status == "installed"),
        "delete"
      );
    }

    if (type == "soft") {
      const resources = asset.resources.map(r => {
        delete r.installation_status;
        delete r.failure_message;
        return r;
      });
      return this.service.findOneAndUpdate(
        {_id: id},
        {$set: {status: "downloaded", resources: resources}}
      );
    }

    if (type == "hard") {
      return this.service.findOneAndDelete({_id: id});
    }

    throw new BadRequestException(`Unknown delete type '${type}'`);
  }

  async operate(resources: Resource[], action: "insert" | "update" | "delete") {
    const copies: Resource[] = this.deepCopy(resources);

    const operations = copies.map(copy => {
      const relatedOperators = operators.get(copy.module);
      if (!relatedOperators || !relatedOperators.length) {
        throw new BadRequestException(
          `Operation ${action} has been failed: Unknown module named '${copy.module}'.`
        );
      }

      return () =>
        Promise.all(
          relatedOperators.map(operator =>
            operator[action](copy)
              .then(() => {
                copy.installation_status = "installed";
                delete copy.failure_message;
              })
              .catch(e => {
                copy.installation_status = "failed";
                copy.failure_message = e.message ? e.message : e;
              })
          )
        );
    });

    return Promise.all(operations.map(o => o())).then(() => copies);
  }

  async validateResources(resources: Resource[]) {
    const copies: Resource[] = this.deepCopy(resources);

    const validations = copies.map(copy => {
      const relatedValidators = validators.get(copy.module);
      if (!relatedValidators || !relatedValidators.length) {
        throw new BadRequestException(
          `Validation has been failed: Unknown module named '${copy.module}'.`
        );
      }
      return () =>
        Promise.all(
          relatedValidators.map(validator =>
            validator(copy).catch(e => {
              throw new BadRequestException(
                `Module '${copy.module}' resource '${copy._id}' validation has been failed: ${e}`
              );
            })
          )
        );
    });
    await Promise.all(validations.map(v => v()));
  }

  deepCopy(object: any) {
    return JSON.parse(JSON.stringify(object));
  }
}
