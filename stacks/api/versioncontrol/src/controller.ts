import {Controller, Get, InternalServerErrorException, Post, UseGuards} from "@nestjs/common";
import {AuthGuard} from "@spica-server/passport";
import {SyncDirection} from "./interface";
import {Synchronizer} from "./synchronizer";

@Controller("versioncontrol")
export class VersionControlController {
  constructor(private synchronizer: Synchronizer) {}

  // @TODO: add action guads
  @Post("sync")
  @UseGuards(AuthGuard())
  async sync() {
    await this.synchronizer.synchronize(SyncDirection.DocToRep).catch(e => {
      throw new InternalServerErrorException(e);
    });
    return {message: "Synchronization completed successfully."};
  }
}
