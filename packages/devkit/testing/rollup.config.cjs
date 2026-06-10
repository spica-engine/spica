import getConfig from "../rollup.config.js";

// dockerode and get-port are kept external (they're declared runtime deps and are
// loaded lazily / are ESM-only). The shared sync engine (@spica-server/sync) is a
// workspace library and is intentionally NOT external, so rollup inlines it (and its
// small deps: yaml/lodash/diff/colorette) into the published bundle.
module.exports = getConfig("testing", [], ["dockerode", "get-port"]);
