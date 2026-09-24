import getConfig from "../rollup.config.js";

// The shared sync engine (@spica-server/sync) is a workspace library and is intentionally
// NOT external, so rollup inlines it (and its small deps: yaml/lodash/diff/colorette) into
// the published bundle.
module.exports = getConfig("sync");
