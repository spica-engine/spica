import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import {AssetService} from "./service";
import {OBJECT_ID, ObjectId} from "@spica-server/database";
import {Asset, Config, ExportMeta, Resource} from "@spica-server/interface/asset";
import {exporters, listers, operators, registrar, validators} from "./registration";
import {compareResourceGroups} from "@spica-server/core/differ";
import {putConfiguration} from "./helpers";
import {BOOLEAN} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";
import {ASSET_REP_MANAGER} from "./interface";
import {AssetRepManager} from "./representative";
import {createReadStream} from "fs";

/**
 * Mongodb transactions(need to be implemented in tricky way because our db classes does not support it)
 * Authorization, Authentication
 * Migration of policies
 * Deprecation of old endpoints
 * Updates on CLI
 * Updates on asset store
 */

@Controller("asset")
export class AssetController {
  constructor(
    private service: AssetService,
    @Inject(ASSET_REP_MANAGER) private repManager: AssetRepManager
  ) {}

  @Get("resource")
  @UseGuards(AuthGuard())
  async information() {
    const schemas = {};

    for (let [_module, _listers] of listers.entries()) {
      const _resources = [];
      for (let lister of _listers) {
        const moduleResources = await lister();
        _resources.push(...moduleResources);
      }
      schemas[_module] = _resources;
    }

    return schemas;
  }

  // @Get("config/:module")
  // @UseGuards(AuthGuard())
  // async information(@Query("module") module: string) {
  //   const baseSchema = {
  //     title: {
  //       type: "string",
  //       title: "Title",
  //       description:
  //         "It will be displayed on the configuration step while others installing this asset."
  //     },
  //     module: {
  //       type: "string",
  //       title: "Module",
  //       description: "Select one of these modules",
  //       enum: [registrar.getModules()]
  //     }
  //   };

  //   if (!module) {
  //     return baseSchema;
  //   }
  //   return {
  //     ...baseSchema,...{

  //     }
  //   };
  // }

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("asset:index"))
  async find(@Query("url") url: string, @Query("status") status: string) {
    const filter: any = {};

    if (url) {
      filter.url = url;
    }

    if (status) {
      filter.status = status;
    }

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
    @Req() req,
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate(req => req.params.id))
    {configs}: {configs: Config[]},
    @Query("preview", BOOLEAN) preview: boolean
  ) {
    let asset = await this.service.findOne({_id: id});
    if (!asset) {
      throw new NotFoundException();
    }

    // we will update asset already installed with new configuration, so this check should be removed
    // if (asset.status == "installed") {
    //   throw new BadRequestException("Asset is already installed.");
    // }

    asset = putConfiguration(asset, configs);

    // validation seems not possible because some resources should dependent to the others
    // for example buckets of the function bucket triggers must be exist before function installation.
    // await this.validateResources(asset.resources).catch(e => this.onInstallationFailed(id, e));

    const installedAsset = await this.service.findOne({
      url: asset.url,
      status: "installed"
    });
    const {insertions, updations, deletions} = compareResourceGroups<Resource>(
      asset.resources,
      installedAsset ? installedAsset.resources : []
    );

    if (preview) {
      return {insertions, updations, deletions};
    }

    await this.operate(asset._id, insertions, "insert").catch(e =>
      this.onInstallationFailed(id, e)
    );
    await this.operate(asset._id, updations, "update").catch(e => this.onInstallationFailed(id, e));
    await this.operate(asset._id, deletions, "delete").catch(e => this.onInstallationFailed(id, e));

    if (installedAsset) {
      this.service.findOneAndUpdate({_id: installedAsset._id}, {$set: {status: "downloaded"}});
    }

    asset.status = "installed";
    return this.service.findOneAndReplace({_id: asset._id}, asset, {returnOriginal: false});
  }

  async validateResources(resources: Resource[]) {
    const validations = resources.map(resource => {
      const relatedValidators = validators.get(resource.module);
      if (!relatedValidators || !relatedValidators.length) {
        return Promise.reject(
          `Validation has been failed: Unknown module named '${resource.module}'.`
        );
      }
      return relatedValidators.map(validator => validator(resource));
    });
    await Promise.all(validations);
  }

  onInstallationFailed(_id: ObjectId, e: string) {
    e = e.toString();
    this.service.findOneAndUpdate(
      {_id},
      {
        $set: {
          status: "failed",
          failure_message: e
        }
      }
    );
    throw new InternalServerErrorException(e);
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
      await this.operate(asset._id, asset.resources, "delete").catch(e =>
        this.onInstallationFailed(id, e)
      );
    }

    if (type == "soft") {
      return this.service.findOneAndUpdate({_id: id}, {$set: {status: "downloaded"}});
    }

    if (type == "hard") {
      return this.service.findOneAndDelete({_id: id});
    }

    throw new BadRequestException(`Unknown delete type '${type}'`);
  }

  async operate(assetId: ObjectId, resources: Resource[], action: "insert" | "update" | "delete") {
    const operations = resources.map(resource => {
      const relatedOperators = operators.get(resource.module);
      if (!relatedOperators || !relatedOperators.length) {
        throw new BadRequestException(
          `Operation ${action} has been failed: Unknown module named '${resource.module}'.`
        );
      }
      return Promise.all(relatedOperators.map(operator => operator[action](resource)));
    });
    await Promise.all(operations);
  }
}
