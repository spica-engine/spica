import {BadRequestException, Controller, Get, Param} from "@nestjs/common";
import {StatusProvider} from "./interface";

export const providers = new Set<StatusProvider>();

@Controller("status")
export class StatusController {
  private get providers() {
    return Array.from(providers);
  }

  @Get()
  findAll() {
    return Promise.all(this.providers.map(p => p.provide()));
  }

  @Get(":module")
  find(@Param("module") module: string) {
    const provider = this.providers.find(p => p.module == module);

    if (!provider) {
      throw new BadRequestException(`Status for module ${module} does not exist`);
    }

    return provider.provide();
  }
}
