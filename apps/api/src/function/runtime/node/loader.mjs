// See: https://github.com/nodejs/loaders-test/blob/main/commonjs-extension-resolution-loader/loader.js

import {isBuiltin} from "node:module";
import {dirname} from "node:path";
import {cwd} from "node:process";
import {fileURLToPath, pathToFileURL} from "node:url";
import {promisify} from "node:util";

import resolveCallback from "resolve/async.js";

const resolveAsync = promisify(resolveCallback);

const baseURL = pathToFileURL(cwd() + "/").href;

export async function resolve(specifier, context, next) {
  const {parentURL = baseURL} = context;

  if (isBuiltin(specifier)) {
    return next(specifier, context);
  }

  // `resolveAsync` works with paths, not URLs
  if (specifier.startsWith("file://")) {
    specifier = fileURLToPath(specifier);
  }
  const parentPath = fileURLToPath(parentURL);

  let url;
  try {
    const resolution = await resolveAsync(specifier, {
      basedir: dirname(parentPath),
      // For whatever reason, --experimental-specifier-resolution=node doesn't search for .mjs extensions
      // but it does search for index.mjs files within directories
      extensions: [".js", ".json", ".node", ".mjs"]
    });
    url = pathToFileURL(resolution).href;
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") {
      // Match Node's error code
      error.code = "ERR_MODULE_NOT_FOUND";
    }
    throw error;
  }

  return next(url, context);
}
