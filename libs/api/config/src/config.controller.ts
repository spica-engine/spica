import {Controller, Put, Param, Body, Get, UseGuards, NotFoundException} from "@nestjs/common";
import {ConfigService} from "./config.service";
import {ConfigSchemaRegistry} from "./config.schema.registry";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard/src";
import {ReturnDocument} from "@spica-server/database";
import {BaseConfig} from "@spica-server/interface/config";

@Controller("config")
export class ConfigController {
  constructor(
    private readonly configService: ConfigService,
    private readonly configSchemaRegistry: ConfigSchemaRegistry
  ) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("config:index"))
  async getAllConfigs(@ResourceFilter() resourceFilter: object) {
    return this.configService.aggregate([resourceFilter]).toArray();
  }

  @Get(":module")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("config:show"))
  async getConfig(@Param("module") module: string) {
    this.configSchemaRegistry.validateModule(module);
    const config = await this.configService.findOne({module});
    if (!config) {
      throw new NotFoundException(`Configuration with module ${module} does not exist.`);
    }
    return config;
  }

  @Put(":module")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("config:update"))
  async update(@Param("module") module: string, @Body() data: object) {
    const configData: BaseConfig = {
      module,
      options: data
    };
    await this.configSchemaRegistry.validate(configData);
    const updatedConfig = await this.configService.findOneAndReplace(
      {module: configData.module},
      configData,
      {
        returnDocument: ReturnDocument.AFTER,
        upsert: true
      }
    );
    if (!updatedConfig) {
      throw new NotFoundException(`Configuration with module ${module} does not exist.`);
    }
    return updatedConfig;
  }
}
