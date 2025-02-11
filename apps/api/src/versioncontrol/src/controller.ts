import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  InternalServerErrorException,
  Param
} from "@nestjs/common";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";
import {SyncDirection, VersionManager} from "./interface";
import {Synchronizer} from "./synchronizer";

@Controller("versioncontrol")
export class VersionControlController {
  constructor(
    private synchronizer: Synchronizer,
    private vers: VersionManager
  ) {}

  @Get("commands")
  @UseGuards(AuthGuard(), ActionGuard("versioncontrol:update", "versioncontrol"))
  async getCommands() {
    return this.vers.availables();
  }

  @Post("commands/:cmd")
  @UseGuards(AuthGuard(), ActionGuard("versioncontrol:update", "versioncontrol"))
  async performAction(@Param("cmd") cmd: string, @Body() body: any) {
    await this.synchronizer.synchronize(SyncDirection.DocToRep).catch(e => {
      throw new InternalServerErrorException(e.message || e);
    });

    const cmdResult = await this.vers
      .exec(cmd, body)
      .catch(e => {
        throw new BadRequestException(e.message || e);
      })
      .then(res => (typeof res == "string" ? {message: res} : res));

    return this.synchronizer
      .synchronize(SyncDirection.RepToDoc)
      .then(() => cmdResult)
      .catch(e => {
        throw new InternalServerErrorException(e.message || e);
      });
  }
}
