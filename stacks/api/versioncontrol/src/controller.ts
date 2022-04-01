import {Controller, Post, UseGuards} from "@nestjs/common";
import {AuthGuard} from "@spica-server/passport";
import { Synchronizer } from "./synchronizer";

@Controller("versioncontrol")
export class VersionControlController {
    constructor(private synchronizer:Synchronizer){}


  // @TODO: add action guads
  @Post("sync")
  @UseGuards(AuthGuard())
  sync() {
  }
}
