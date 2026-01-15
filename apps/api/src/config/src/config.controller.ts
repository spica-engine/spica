import {Controller, Put, Param, Body, Get, UseGuards} from "@nestjs/common";
import {ConfigService} from "./config.service";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";
import {ReturnDocument} from "@spica-server/database";

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
   * @param module - Module name
   * @returns configuration document
   */
  @Get(":module")
  @UseGuards(AuthGuard(), ActionGuard("config:show"))
  async getConfig(@Param("module") module: string) {
    return this.configService.findOne({module});
  }

  /**
   * Update an existing configuration
   * @param module - Module name
   * @param data - Configuration data
   * @returns Updated document
   */
  @Put(":module")
  @UseGuards(AuthGuard(), ActionGuard("config:update"))
  async update(@Param("module") module: string, @Body() data: any) {
    return this.configService.findOneAndReplace({module}, data, {
      returnDocument: ReturnDocument.AFTER
    });
  }
}
