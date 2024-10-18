/**
 * Symlinks database as @internal/database for backward-compatibility.
 */
const path = require("path");
const fs = require("fs");

const modulePath = path.dirname(require.resolve("@spica-devkit/database/package.json"));
const nodeModulesRoot = path.join(modulePath, "..", "..");
const targetPath = path.join(nodeModulesRoot, "@internal");

try {
  fs.mkdirSync(targetPath);
  fs.symlinkSync(modulePath, path.join(targetPath, "database"), "dir");
} catch (error) {
  if (error.code != "EEXIST") {
    throw error;
  }
}
