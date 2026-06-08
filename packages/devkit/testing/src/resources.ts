import {HttpClient} from "./http";

/**
 * Installs CLI-format resources (bucket/, function/, policy/, env-var/, secret/) from a
 * folder into the running instance by reusing the CLI sync engine. Functions are compiled
 * server-side on upload, so no local toolchain is required.
 *
 * The CLI is ESM-only and heavy, so its engine is loaded lazily via dynamic import - this
 * keeps the CommonJS build working and keeps the CLI graph out of unrelated unit tests.
 * Exposed as an object so tests can spy on `install`.
 */
export const resourceInstaller = {
  async install(http: HttpClient, resourcePath: string): Promise<{errors: string[]}> {
    const {buildPlan, applyPlan} = await import("@spica/cli/src/commands/sync/planner");
    const {ALL_MODULES} = await import("@spica/cli/src/commands/sync/modules/index");
    const plan = await buildPlan(ALL_MODULES as any, http as any, resourcePath);
    return applyPlan(plan, http as any, {concurrency: 10, abortOnError: true});
  }
};
