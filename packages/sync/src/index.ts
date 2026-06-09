// Public surface of the Spica resource-sync engine.
//
// Consumed by `@spica/cli` (the `spica project sync/apply/fetch/dev` commands)
// and by `@spica-devkit/testing` (to install CLI-format resources into a
// disposable instance). Keep this barrel stable — it is the contract both
// consumers import against.

export * from "./types";
export * from "./http";
export * from "./reporter";
export * from "./fs-utils";
export * from "./planner";
export * from "./modules/index";

// Individual resource modules (the barrel above only exposes the aggregate
// ALL_MODULES / resolveModules helpers).
export {bucketModule} from "./modules/bucket";
export {envVarModule} from "./modules/env-var";
export {functionModule} from "./modules/function";
export {policyModule} from "./modules/policy";
export {secretModule} from "./modules/secret";
