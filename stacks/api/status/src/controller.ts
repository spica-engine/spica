import {BadRequestException, Controller, Get, Param, Query} from "@nestjs/common";
import {DATE} from "@spica-server/core";
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

  @Get("api")
  findApi(@Query("begin", DATE) begin: Date, @Query("end", DATE) end: Date) {
    console.log(begin,end)
    return this.providers.find(p => p.module == "api").provide(begin, end);
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
