// Custom Jest resolver that:
// 1. Adds the 'types' export condition for workspace packages so @spica-server/*
//    and @spica-devkit/* imports resolve to TypeScript source via package.json exports.
// 2. Maps .js extensions to .ts for relative imports (ESM TypeScript convention where
//    source files use .js extensions with moduleResolution: "bundler").
const path = require("path");
const WORKSPACE_PREFIXES = ["@spica-server/", "@spica-devkit/"];

module.exports = function (request, options) {
  // For workspace packages, add 'types' condition to resolve to TS source
  if (WORKSPACE_PREFIXES.some(prefix => request.startsWith(prefix))) {
    return options.defaultResolver(request, {
      ...options,
      conditions: [...new Set([...(options.conditions || []), "types"])]
    });
  }

  // For relative .js imports, try .ts first (ESM TypeScript pattern)
  if (request.startsWith(".") && request.endsWith(".js")) {
    const tsRequest = request.slice(0, -3) + ".ts";
    try {
      return options.defaultResolver(tsRequest, options);
    } catch {
      // Fall through to default resolution
    }
  }

  return options.defaultResolver(request, options);
};
