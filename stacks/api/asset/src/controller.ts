import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query
} from "@nestjs/common";
import {AssetService} from "./service";
import {OBJECT_ID, ObjectId} from "@spica-server/database";
import {Asset, Configuration, Resource} from "./interface";
import {operators, validators} from "./registration";
import {compareResourceGroups} from "@spica-server/core/differ";
import {putConfiguration} from "./helpers";

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
    return this.service.findOne({_id: id});
  }

  @Post()
  // @UseGuards(AuthGuard(), ActionGuard("asset:index", "asset"))
  async insert(@Body() asset: Asset) {
    const existingAssets = await this.service.find({name: asset.name});
    if (existingAssets.length) {
      throw new BadRequestException("Asset already exists.");
    }

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
  async install(@Param("id") id: ObjectId, @Body() configs: Configuration[]) {
    let asset = await this.service.findOne({_id: id});

    if (!asset || asset.status == "installed") {
      throw new BadRequestException("Asset does not exist or already installed");
    }

    asset = putConfiguration(asset, configs);

    const validations = asset.resources.map(resource => {
      const validator = validators.get(resource.module);
      return validator(resource);
    });
    await Promise.all(validations);

    const installedAsset = await this.service.findOne({_id: {$ne: asset._id}, name: asset.name});
    const {insertions, updations, deletions} = compareResourceGroups<Resource>(
      installedAsset ? installedAsset.resources : [],
      asset.resources
    );

    const inserts = insertions.map(resource => {
      const operator = operators.get(resource.module);
      operator.insert(resource);
    });
    await Promise.all(inserts);

    const updates = updations.map(resource => {
      const operator = operators.get(resource.module);
      operator.update(resource);
    });
    await Promise.all(updates);

    const deletes = deletions.map(resource => {
      const operator = operators.get(resource.module);
      operator.insert(resource);
    });
    await Promise.all(deletes);

    asset.status = "installed";
    return this.service.findOneAndReplace({_id: asset._id}, asset);
  }

  @Delete(":id")
  // @UseGuards(AuthGuard(), ActionGuard("asset:index", "asset"))
  async delete(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Query("type") type: "soft" | "hard" = "soft"
  ) {
    const asset = await this.service.findOne({_id: id});

    const deletions = asset.resources.map(resource => {
      const operator = operators.get(resource.module);
      return operator.delete(resource);
    });
    await Promise.all(deletions);

    if (type == "soft") {
      return this.service.findOneAndUpdate({_id: id}, {$set: {status: "downloaded"}});
    }

    if (type == "hard") {
      return this.service.findOneAndDelete({_id: id});
    }

    throw new BadRequestException(`Unknown delete type '${type}'`);
  }
}
