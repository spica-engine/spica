import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {AssetService} from "./service";
import {OBJECT_ID, ObjectId} from "@spica-server/database";
import {Asset, Configuration, Resource} from "@spica-server/interface/asset";
import {operators, validators} from "./registration";
import {compareResourceGroups} from "@spica-server/core/differ";
import {putConfiguration} from "./helpers";
import {BOOLEAN} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";

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
  constructor(private service: AssetService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("asset:index"))
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
    {configs}: {configs: Configuration[]},
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
      name: asset.name,
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

    if (asset.status == "installed") {
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

  @Post()
  @UseGuards(AuthGuard(), ActionGuard("asset:export", "asset"))
  async export(){
    
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
