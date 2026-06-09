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
    // These import the CLI's internal sync engine directly rather than via a public API.
    // If the CLI ever moves or renames these files the failure will be a runtime error, not
    // a compile-time one. TODO: ask the CLI package to re-export buildPlan/applyPlan/ALL_MODULES
    // from its top-level or a documented sub-path so this coupling can be enforced by TS.
    // The `as any` casts below are required because the CLI's internal HttpClient type differs
    // structurally from this package's HttpClient (extra methods, different generics); the
    // runtime shapes are compatible.
    const {buildPlan, applyPlan} = await import("@spica/cli/src/commands/sync/planner");
    const {ALL_MODULES} = await import("@spica/cli/src/commands/sync/modules/index");
    const plan = await buildPlan(ALL_MODULES as any, http as any, resourcePath);
    return applyPlan(plan, http as any, {concurrency: 10, abortOnError: true});
  }
};
