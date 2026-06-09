import {buildPlan, applyPlan, ALL_MODULES} from "@spica-server/sync";
import {HttpClient} from "./http";

/**
 * Installs CLI-format resources (bucket/, function/, policy/, env-var/, secret/) from a
 * folder into the running instance by reusing the shared Spica sync engine. Functions are
 * compiled server-side on upload, so no local toolchain is required.
 *
 * The engine lives in `@spica-server/sync` (the same package the CLI's
 * `spica project apply` uses), so resource installation here stays byte-for-byte
 * faithful to how the CLI applies resources. Exposed as an object so tests can spy on
 * `install`.
 */
export const resourceInstaller = {
  async install(http: HttpClient, resourcePath: string): Promise<{errors: string[]}> {
    const plan = await buildPlan(ALL_MODULES, http, resourcePath);
    return applyPlan(plan, http, {concurrency: 10, abortOnError: true});
  }
};
