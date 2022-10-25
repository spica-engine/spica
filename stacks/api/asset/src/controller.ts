import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query
} from "@nestjs/common";
import {AssetService} from "./service";
import {OBJECT_ID, ObjectId} from "@spica-server/database";
import {Asset, Configuration, Resource} from "./interface";
import {operators, validators} from "./registration";
import {compareResourceGroups} from "@spica-server/core/differ";
import {putConfiguration} from "./helpers";
import {ARRAY, BOOLEAN, DEFAULT} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";

/**
 * Authorization, Authentication
 * Migration of policies
 * Schema validation
 * Deprecation of old endpoints
 * Updates on CLI
 */


@Controller("asset")
export class AssetController {
  constructor(private service: AssetService) {}

  @Get()
  // @UseGuards(AuthGuard(), ActionGuard("asset:index", "asset"))
  async find(@Query("name") name: string, @Query("status") status: string) {
    const filter: any = {};

    if (name) {
      filter.name = name;
    }

    if (status) {
      filter.status = status;
    }

    return this.service.find(filter);
  }

  @Get(":id")
  // @UseGuards(AuthGuard(), ActionGuard("asset:index", "asset"))
  async findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.service.findOne({_id: id}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
      return r;
    });
  }

  @Post()
  // @UseGuards(AuthGuard(), ActionGuard("asset:index", "asset"))
  async insert(@Body(Schema.validate("http://spica.internal/asset")) asset: Asset) {
    asset.status = "downloaded";
    return this.service.insertOne(asset);
  }

  // PUT
  // i don't think there should be put endpoint for updating assets
  // updating asset means updating asset resources, but first downloading asset, then installing asset with configuration is a better asset update flow
  // post request to asset will detect

  // POST /id
  // should accept configuration file
  // should update if there is any asset that was installed and has same name
  // should insert if there is no asset that was installed and has same name

  // DELETE /id
  // there might be an option like "soft" and "hard", delete action will be performed based on this parameter

  @Post(":id")
  async install(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/asset"), DEFAULT([]), ARRAY(c => c))
    configs: Configuration[],
    @Query("preview", BOOLEAN) preview: boolean
  ) {
    let asset = await this.service.findOne({_id: id});
    if (!asset) {
      throw new NotFoundException();
    }

    if (asset.status == "installed") {
      throw new BadRequestException("Asset is already installed.");
    }

    asset = putConfiguration(asset, configs);

    await this.validateResources(asset.resources).catch(e => this.onInstallationFailed(id, e));

    const installedAsset = await this.service.findOne({
      _id: {$ne: id},
      name: asset.name,
      status: "installed"
    });
    const {insertions, updations, deletions} = compareResourceGroups<Resource>(
      installedAsset ? installedAsset.resources : [],
      asset.resources
    );

    if (preview) {
      return {insertions, updations, deletions};
    }

    await this.operate(insertions, "insert").catch(e => this.onInstallationFailed(id, e));
    await this.operate(updations, "update").catch(e => this.onInstallationFailed(id, e));
    await this.operate(deletions, "delete").catch(e => this.onInstallationFailed(id, e));

    if (installedAsset) {
      this.service.findOneAndUpdate({_id: installedAsset._id}, {$set: {status: "downloaded"}});
    }

    asset.status = "installed";
    return this.service.findOneAndReplace({_id: asset._id}, asset, {returnOriginal: false});
  }

  async validateResources(resources: Resource[]) {
    const validations = resources.map(resource => {
      const validator = validators.get(resource.module);
      if (!validator) {
        return Promise.reject(
          `Validation has been failed: Unknown module named '${resource.module}'.`
        );
      }
      return validator(resource);
    });
    await Promise.all(validations);
  }

  async onInstallationFailed(_id: ObjectId, e: string) {
    this.service.findOneAndUpdate(
      {_id},
      {
        $set: {
          status: "failed",
          failure_message: e
        }
      }
    );
    throw new BadRequestException(e);
  }

  @Delete(":id")
  // @UseGuards(AuthGuard(), ActionGuard("asset:index", "asset"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Query("type") type: "soft" | "hard" = "soft"
  ) {
    const asset = await this.service.findOne({_id: id});

    await this.operate(asset.resources, "delete").catch(e => this.onInstallationFailed(id, e));

    if (type == "soft") {
      return this.service.findOneAndUpdate({_id: id}, {$set: {status: "downloaded"}});
    }

    if (type == "hard") {
      return this.service.findOneAndDelete({_id: id});
    }

    throw new BadRequestException(`Unknown delete type '${type}'`);
  }

  operate(resources: Resource[], action: "insert" | "update" | "delete") {
    const operations = resources.map(resource => {
      const operator = operators.get(resource.module);
      if (!operator) {
        throw new BadRequestException(
          `Operation ${action} has been failed: Unknown module named '${resource.module}'.`
        );
      }
      return operator[action](resource);
    });
    return Promise.all(operations);
  }
}
