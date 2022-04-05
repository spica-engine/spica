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
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import {SyncDirection, VersionManager} from "./interface";
import {Synchronizer} from "./synchronizer";

@Controller("versioncontrol")
export class VersionControlController {
  constructor(private synchronizer: Synchronizer, private vers: VersionManager) {}

  @Get("sync")
  @UseGuards(AuthGuard(), ActionGuard("version:show"))
  getSyncLog() {
    return this.synchronizer.getLastSync();
  }

  @Post("sync")
  @UseGuards(AuthGuard(), ActionGuard("version:update"))
  sync() {
    return this.synchronizer.synchronize(SyncDirection.DocToRep).catch(e => {
      throw new InternalServerErrorException(e);
    });
  }

  @Get("commands")
  @UseGuards(AuthGuard(), ActionGuard("version:show"))
  async getCommands() {
    return this.vers.availables();
  }

  // @TODO: add action guads
  @Post("commands/:cmd")
  @UseGuards(AuthGuard(), ActionGuard("version:update"))
  async performAction(@Param("cmd") cmd: string, @Body() body: any) {
    const cmdResult = await this.vers.exec(cmd, body).catch(e => {
      throw new BadRequestException(e.message || e);
    });

    return this.synchronizer.synchronize(SyncDirection.RepToDoc).then(syncResult => {
      return {
        cmdResult,
        syncResult
      };
    });
  }
}
