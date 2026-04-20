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
import {ActionGuard, AuthGuard} from "@spica-server/passport-guard";
import {VersionManager} from "./interface.js";

@Controller("versioncontrol")
export class VersionControlController {
  private readonly logger = new Logger(VersionControlController.name);

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
        const internalMsg =
          `Command execution failed: ${cmd}\n` + (e instanceof Error ? e.stack : String(e));
        const externalMsg = e instanceof Error ? e.message : String(e);
        this.logger.error(internalMsg);
        throw new BadRequestException(externalMsg);
      })
      .then(res => (typeof res == "string" ? {message: res} : res));

    return cmdResult;
  }
}
