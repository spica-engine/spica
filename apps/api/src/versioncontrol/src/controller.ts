import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  UseGuards,
  Param
} from "@nestjs/common";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";
import {VersionManager} from "./interface";

@Controller("versioncontrol")
export class VersionControlController {
  constructor(private vers: VersionManager) {}

  @Get("commands")
  @UseGuards(
    AuthGuard(["IDENTITY", "APIKEY"]),
    ActionGuard("versioncontrol:update", "versioncontrol")
  )
  async getCommands() {
    return this.vers.availables();
  }

  @Post("commands/:cmd")
  @UseGuards(
    AuthGuard(["IDENTITY", "APIKEY"]),
    ActionGuard("versioncontrol:update", "versioncontrol")
  )
  async performAction(@Param("cmd") cmd: string, @Body() body: any) {
    const available = this.vers.availables();
    if (!available.includes(cmd)) {
      throw new BadRequestException("Unknown command");
    }

    const cmdResult = await this.vers
      .exec(cmd, body)
      .catch(e => {
        console.error(`Error executing command ${cmd}:`, e);
        throw new BadRequestException("Command execution failed");
      })
      .then(res => (typeof res == "string" ? {message: res} : res));

    return cmdResult;
  }
}
