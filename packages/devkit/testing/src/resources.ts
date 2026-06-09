import {buildPlan, applyPlan, ALL_MODULES} from "@spica-server/sync";
import {HttpClient} from "./http";

export interface InstallResourcesOptions {
  /** Max resources applied in parallel per module. Default 10. */
  concurrency?: number;
  /**
   * Abort the whole install on the first failing resource instead of installing the rest
   * best-effort. Default false — failures are collected and returned in `errors`.
   */
  abortOnError?: boolean;
}

/**
 * Installs CLI-format resources (bucket/, function/, policy/, env-var/, secret/) from a
 * folder into the running instance by reusing the shared Spica sync engine. Functions are
 * compiled server-side on upload, so no local toolchain is required.
 *
 * The engine lives in `@spica-server/sync` (the same package the CLI's
 * `spica project apply` uses), so resource installation here stays byte-for-byte
 * faithful to how the CLI applies resources. Exposed as an object so tests can spy on
 * `install`.
 *
 * Resources are applied best-effort by default (abortOnError: false): a single failing
 * resource (e.g. one function whose server-side dependency install fails) does NOT abort
 * the whole install, so the rest of the project still lands and every failure is returned
 * in `errors`. Installing a real, multi-resource project is the common case, and aborting
 * on the first failure would leave the instance half-provisioned and throw instead of
 * honouring the `{errors}` contract. Pass `abortOnError: true` to fail fast instead.
 */
export const resourceInstaller = {
  async install(
    http: HttpClient,
    resourcePath: string,
    options: InstallResourcesOptions = {}
  ): Promise<{errors: string[]}> {
    const {concurrency = 10, abortOnError = false} = options;
    const plan = await buildPlan(ALL_MODULES, http, resourcePath);
    return applyPlan(plan, http, {concurrency, abortOnError});
  }
};
