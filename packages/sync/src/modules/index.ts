import {bucketModule} from "./bucket";
import {envVarModule} from "./env-var";
import {functionModule} from "./function";
import {policyModule} from "./policy";
import {secretModule} from "./secret";
import {ResourceModule} from "../types";

/**
 * Apply order matters: policy → bucket → env-var → secret → function.
 * Function is last because it may reference env-var/secret values.
 */
export const ALL_MODULES: ResourceModule[] = [
  policyModule,
  bucketModule,
  envVarModule,
  secretModule,
  functionModule
];

export const MODULE_NAMES = ALL_MODULES.map(m => m.name);

export function resolveModules(names?: string[]): ResourceModule[] {
  if (!names || names.length === 0) return ALL_MODULES;
  return [...new Set(names)].map(name => {
    const mod = ALL_MODULES.find(m => m.name === name);
    if (!mod) throw new Error(`Unknown module: "${name}". Available: ${MODULE_NAMES.join(", ")}`);
    return mod;
  });
}
