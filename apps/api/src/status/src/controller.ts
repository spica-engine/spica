import {BadRequestException, Controller, Get, Param, Query, UseGuards} from "@nestjs/common";
import {DATE} from "@spica-server/core";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import {StatusProvider} from "@spica-server/interface/status";

export const providers = new Set<StatusProvider>();

@Controller("status")
export class StatusController {
  private get providers() {
    return Array.from(providers);
  }

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("status:index"))
  findAll(
    @ResourceFilter({pure: true})
    resourceFilter = {
      includeds: [],
      excludeds: []
    }
  ) {
    return Promise.all(
      this.providers
        .filter(p => {
          if (resourceFilter.includeds.length) {
            return resourceFilter.includeds.includes(p.module);
          } else if (resourceFilter.excludeds.length) {
            return !resourceFilter.excludeds.includes(p.module);
          }
          return true;
        })
        .map(p => p.provide())
    );
  }

  @Get(":module")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("status:show"))
  find(
    @Param("module") module: string,
    @Query("begin", DATE) begin: Date,
    @Query("end", DATE) end: Date
  ) {
    const provider = this.providers.find(p => p.module == module);

    if (!provider) {
      throw new BadRequestException(`Status for module ${module} does not exist`);
    }

    return provider.provide(begin, end);
  }
}
