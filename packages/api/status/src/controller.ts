import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Query,
  ServiceUnavailableException,
  UseGuards
} from "@nestjs/common";
import {DATE} from "@spica-server/core";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport-guard";
import {StatusProvider} from "@spica-server/interface-status";
import {DatabaseService} from "@spica-server/database";

export const providers = new Set<StatusProvider>();

@Controller("status")
export class StatusController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private get providers() {
    return Array.from(providers);
  }

  @Get("live")
  @HttpCode(HttpStatus.OK)
  liveness() {
    return {status: "ok"};
  }

  @Get("ready")
  @HttpCode(HttpStatus.OK)
  async readiness() {
    try {
      await this.db.ping();
      return {status: "ok"};
    } catch {
      throw new ServiceUnavailableException("Database is not ready");
    }
  }

  /**
   * The driver's capability declaration (K-10) and the backend's identity (K-8).
   *
   * The panel reads it, hides the interfaces that have no counterpart, and shows the backend name
   * **read-only** — K-8: the backend choice is a provisioning decision and cannot be changed from the
   * panel.
   *
   * It requires authentication but has NO separate policy action: the content is capability information
   * rather than configuration, and everyone who uses the panel needs to see it. Adding a new action would
   * mean the panel silently showing an empty interface on existing installations.
   */
  @Get("capabilities")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]))
  capabilities() {
    return {
      backend: this.db.capabilities.backend,
      database: this.db.databaseName,
      capabilities: this.db.capabilities
    };
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
