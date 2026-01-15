import {BadRequestException, Body, Controller, Get, Post, UseGuards, Param} from "@nestjs/common";
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
    const cmdResult = await this.vers
      .exec(cmd, body)
      .catch(e => {
        throw new BadRequestException(e.message || e);
      })
      .then(res => (typeof res == "string" ? {message: res} : res));

    return cmdResult;
  }
}
