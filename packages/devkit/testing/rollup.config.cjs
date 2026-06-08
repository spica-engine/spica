import getConfig from "../rollup.config.js";

// dockerode and get-port are not in the shared externals list, and @spica/cli is
// consumed via deep subpath imports (its own dist) - keep all of them external so
// rollup neither bundles them nor walks into the CLI's caporal/ora dependency graph.
module.exports = getConfig("testing", [], ["dockerode", "get-port", /^@spica\/cli(\/.*)?$/]);
