import {buildPlan, applyPlan, ALL_MODULES, MODULE_NAMES, ResourceModule} from "@spica-server/sync";
import {HttpClient} from "./http";
import {ResourceModuleName, ResourceSelection} from "./interface";

export interface InstallResourcesOptions {
  /** Max resources applied in parallel per module. Default 10. */
  concurrency?: number;
  /**
   * Abort the whole install on the first failing resource instead of installing the rest
   * best-effort. Default false — failures are collected and returned in `errors`.
   */
  abortOnError?: boolean;
  /** Install only the named modules/resources instead of everything. */
  selection?: ResourceSelection;
}

/** Throw if a selection names a module the sync engine doesn't know. Cheap + synchronous. */
export function assertSelectionModules(selection: ResourceSelection): void {
  const unknown = Object.keys(selection).filter(name => !MODULE_NAMES.includes(name));
  if (unknown.length) {
    throw new Error(
      `Unknown module(s) in installResources selection: ${unknown.join(", ")}. ` +
        `Available: ${MODULE_NAMES.join(", ")}`
    );
  }
}

/**
 * Resolve a selection to the modules buildPlan should read, in the canonical apply order
 * (policy → bucket → env-var → secret → function). A module selected with a list gets a
 * wrapped `readLocal` that returns only the named resources (and fails on an unknown name).
 */
function selectModules(selection: ResourceSelection): ResourceModule[] {
  assertSelectionModules(selection);

  return ALL_MODULES.filter(mod => mod.name in selection).map(mod => {
    const wanted = selection[mod.name as ResourceModuleName];
    if (wanted === true || wanted === undefined) return mod;

    const slugs = new Set(wanted);
    return {
      ...mod,
      readLocal: async (rootDir: string) => {
        const all = await mod.readLocal(rootDir);
        const available = new Set(all.map(r => r.slug));
        const missing = wanted.filter(name => !available.has(name));
        if (missing.length) {
          throw new Error(
            `${mod.displayName} resources not found under ${rootDir}: ${missing.join(", ")}`
          );
        }
        return all.filter(r => slugs.has(r.slug));
      }
    };
  });
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
 * Pass `selection` to install only a slice of the project (a feature test rarely needs the
 * whole thing). Resources are applied best-effort by default (abortOnError: false): a single
 * failing resource (e.g. one function whose server-side dependency install fails) does NOT
 * abort the whole install, so the rest still lands and every failure is returned in `errors`.
 * Pass `abortOnError: true` to fail fast instead.
 */
export const resourceInstaller = {
  async install(
    http: HttpClient,
    resourcePath: string,
    options: InstallResourcesOptions = {}
  ): Promise<{errors: string[]}> {
    const {concurrency = 10, abortOnError = false, selection} = options;
    const modules = selection ? selectModules(selection) : ALL_MODULES;
    const plan = await buildPlan(modules, http, resourcePath);
    return applyPlan(plan, http, {concurrency, abortOnError});
  }
};
