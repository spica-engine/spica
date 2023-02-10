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
import {exporters, operators, validators} from "./registration";
import {compareResourceGroups} from "@spica-server/core/differ";
import {putConfiguration} from "./helpers";
import {BOOLEAN, DEFAULT, JSONP} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";
import {ASSET_REP_MANAGER} from "./interface";
import {AssetRepManager} from "./representative";
import {createReadStream} from "fs";

/**
 * Mongodb transactions
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

    const installedAsset = await this.service.findOne({
      url: asset.url,
      status: {$in: ["installed", "partially_installed"]}
    });

    if (
      installedAsset &&
      installedAsset._id.toString() != asset._id.toString() &&
      installedAsset.status == "partially_installed"
    ) {
      throw new BadRequestException(
        "Found another version of this asset with partially_installed status. Please reinstall or remove that version before install a new one."
      );
    }

    const existingResources = installedAsset
      ? installedAsset.resources.filter(resource => resource.installation_status != "failed")
      : [];

    const {insertions, updations, deletions} = compareResourceGroups<Resource>(
      asset.resources,
      existingResources,
      {uniqueField: "_id", ignoredFields: ["installation_status", "failure_message"]}
    );

    if (preview) {
      return {insertions, updations, deletions};
    }

    await Promise.all([
      this.operate(insertions, "insert"),
      this.operate(updations, "update"),
      this.operate(deletions, "delete")
    ]);

    this.updateResourceStatuses([...insertions, ...updations, ...deletions], asset, installedAsset);

    const isPartiallyInstalled = asset.resources.some(r => r.installation_status == "failed");

    asset.status = isPartiallyInstalled ? "partially_installed" : "installed";

    if (installedAsset && installedAsset._id.toString() != asset._id.toString()) {
      const resources = installedAsset.resources.map(r => {
        delete r.failure_message;
        delete r.installation_status;
        return r;
      });
      this.service.findOneAndUpdate(
        {_id: installedAsset._id},
        {$set: {resources: resources, status: "downloaded"}}
      );
    }

    return this.service.findOneAndReplace({_id: asset._id}, asset, {returnOriginal: false});
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

  async operate(originals: Resource[], action: "insert" | "update" | "delete") {
    const copies: Resource[] = this.deepCopy(originals);

    const operations = copies.map((copy, i) => {
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
                originals[i].installation_status = "installed";
                delete originals[i].failure_message;
              })
              .catch(e => {
                originals[i].installation_status = "failed";
                originals[i].failure_message = e.message ? e.message : e;
              })
          )
        );
    });
    await Promise.all(operations.map(o => o()));
  }

  async validateResources(originals: Resource[]) {
    const copies: Resource[] = this.deepCopy(originals);

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

  updateResourceStatuses(resourcesAfterInstall: Resource[], asset: Asset, previousAsset?: Asset) {
    for (const resourceAfterInstall of resourcesAfterInstall) {
      asset.resources = asset.resources.map(resource => {
        if (resource._id.toString() == resourceAfterInstall._id.toString()) {
          resource.installation_status = resourceAfterInstall.installation_status;
          if (resourceAfterInstall.failure_message) {
            resource.failure_message = resourceAfterInstall.failure_message;
          } else {
            delete resource.failure_message;
          }
        }

        return resource;
      });
    }

    // previous asset might be installed partially
    // and resources that exist both(pre,curr) assets and installed from previous asset won't be installed again(optimization)
    // but these resources on the current asset should be marked as installed
    if (previousAsset) {
      asset.resources = asset.resources.map(curRes => {
        const resourceAlreadyInstalled = previousAsset.resources.find(
          preRes =>
            preRes._id.toString() == curRes._id.toString() &&
            preRes.installation_status == "installed"
        );

        if (resourceAlreadyInstalled) {
          curRes.installation_status = "installed";
        }

        return curRes;
      });
    }
  }
}
