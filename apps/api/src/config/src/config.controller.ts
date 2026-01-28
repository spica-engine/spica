import {Controller, Put, Param, Body, Get, UseGuards, NotFoundException} from "@nestjs/common";
import {ConfigService} from "./config.service";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";
import {ReturnDocument} from "@spica-server/database";
import {Schema} from "@spica-server/core/schema";
import {BaseConfig} from "@spica-server/interface/config";

@Controller("config")
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Get all configurations
   * @returns List of configurations
   */
  @Get()
  @UseGuards(AuthGuard(), ActionGuard("config:index"))
  async getAllConfigs() {
    return this.configService.find({});
  }

  /**
   * Get a configuration by module name
   * @param module Module name
   * @returns Configuration document
   */
  @Get(":module")
  @UseGuards(AuthGuard(), ActionGuard("config:show"))
  async getConfig(
    @Param("module", Schema.validate("http://spica.internal/config#/properties/module"))
    module: string
  ) {
    const config = await this.configService.findOne({module});
    if (!config) {
      throw new NotFoundException(`Configuration with module ${module} does not exist.`);
    }
    return config;
  }

  /**
   * Update an existing configuration
   * @param module Module name
   * @param data Configuration data
   * @returns Updated document
   */
  @Put(":module")
  @UseGuards(AuthGuard(), ActionGuard("config:update"))
  async update(
    @Param("module") module: string,
    @Body(Schema.validate("http://spica.internal/config")) data: BaseConfig
  ) {
    const updatedConfig = await this.configService.findOneAndReplace({module}, data, {
      returnDocument: ReturnDocument.AFTER
    });
    if (!updatedConfig) {
      throw new NotFoundException(`Configuration with module ${module} does not exist.`);
    }
    return updatedConfig;
  }
}
