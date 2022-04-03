import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  InternalServerErrorException
} from "@nestjs/common";
import {AuthGuard} from "@spica-server/passport";
import {SyncDirection, VersionManager} from "./interface";
import {Synchronizer} from "./synchronizer";

@Controller("versioncontrol")
export class VersionControlController {
  constructor(private synchronizer: Synchronizer, private vers: VersionManager) {}
  @Post("sync")
  @UseGuards(AuthGuard())
  sync() {
    return this.synchronizer.synchronize(SyncDirection.DocToRep).catch(e => {
      throw new InternalServerErrorException(e);
    });
  }

  @Get("sync")
  @UseGuards(AuthGuard())
  getSyncLog() {
    return this.synchronizer.getLastSync();
  }

  // @TODO: add action guads
  @Post()
  @UseGuards(AuthGuard())
  async performAction(@Query("action") action: string, @Body() body: any) {
    await this.vers.run(action, body).catch(e => {
      throw new BadRequestException(e.message || e);
    });

    return this.synchronizer.synchronize(SyncDirection.RepToDoc);
  }
}
