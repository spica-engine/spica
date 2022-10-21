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
import {Asset} from "./interface";
import {operators, validators} from "./registration";

@Controller("asset")
export class AssetController {
  constructor(private service: AssetService) {}

  @Get()
  // @UseGuards(AuthGuard(), ActionGuard("asset:index", "asset"))
  async find(@Query("name") name: string) {
    const filter: any = {};

    if (name) {
      filter.name = name;
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
      throw new BadRequestException("Asset is already exists.");
    }

    const validations = [];
    for (let resource of asset.resources) {
      const validator = validators.get(resource.module);

      if (!validator) {
        throw new BadRequestException(
          `Module named ${resource.module} has no validator to validate schema.`
        );
      }

      validations.push(validator(resource));
    }
    await Promise.all(validations);

    const operations = [];
    for (let resource of asset.resources) {
      const operator = operators.get(resource.module);

      if (!operator) {
        throw new BadRequestException(
          `Module named ${resource.module} has no operator to perform insert operation.`
        );
      }

      operations.push(operator.insert(resource));
    }

    await Promise.all(operations);

    asset.status = "ready";
    return this.service.insertOne(asset);
  }

  @Put(":id")
  // @UseGuards(AuthGuard(), ActionGuard("asset:index", "asset"))
  async update(@Param("id", OBJECT_ID) id: ObjectId, @Body() asset: Asset) {
    // check if asset is exist, throw error if it does not
    // validate resources
    // if it is passed, insert assets to the asset collection directly, skip the module insertions until configuration is completed
    // else pass it to the module handlers, they will decide which asset will be deleted, inserted, updated etc.
  }

  @Delete(":id")
  // @UseGuards(AuthGuard(), ActionGuard("asset:index", "asset"))
  async delete(@Param("id", OBJECT_ID) id: ObjectId) {
    // just delete the asset and it's resources.

    const asset = await this.service.findOne({_id: id});

    const operations = [];
    for (let resource of asset.resources) {
      const operator = operators.get(resource.module);

      if (!operator) {
        throw new BadRequestException(
          `Module named ${resource.module} has no operator to perform delete operation.`
        );
      }

      operations.push(operator.delete(resource));
    }

    await Promise.all(operations);

    return this.service.deleteOne({_id: id});
  }

  needsConfiguration(asset: Asset) {
    return asset.configurations.some(c => !c.configured);
  }
}
