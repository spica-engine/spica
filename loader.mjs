import {resolve as pathResolve} from "path";
import {fileURLToPath, pathToFileURL} from "url";
import fs from "fs";

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return nextResolve(specifier, context);
  }

  const resolvedPath = pathResolve(fileURLToPath(new URL(specifier, context.parentURL)));

  const indexFile = pathResolve(resolvedPath, "index.mjs");

  if (fs.existsSync(indexFile)) {
    return nextResolve(pathToFileURL(indexFile).href, context);
  }

  return nextResolve(specifier, context);
}
