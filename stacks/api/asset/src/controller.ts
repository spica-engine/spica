import {Body, Controller, Delete, Get, Param, Post, Put, UseGuards} from "@nestjs/common";
import {AssetService} from "./service";
import {OBJECT_ID, ObjectId} from "@spica-server/database";
import {Asset} from "./interface";

@Controller("asset")
export class AssetController {
  constructor(private service: AssetService) {}

  @Get()
  // @UseGuards(AuthGuard(), ActionGuard("asset:index", "asset"))
  async find(filter: object) {
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
    // check if asset is exist, throw error it exists
    // other modules should provide validation methon
    // if validation is passed, check asset has need configuration
    // if it does, insert assets to the asset collection directly, skip the module insertions until configuration is completed
    // else insert resources
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
  }

  needsConfiguration(asset: Asset) {
    return asset.configurations.some(c => !c.configured);
  }
}
