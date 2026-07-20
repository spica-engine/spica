import fs from "fs";
import path from "path";
import {BuildMeta} from "@spica-server/interface-function-builder";

export function prepareOutDir(meta: BuildMeta): Promise<string> {
  return fs.promises.mkdir(path.join(meta.cwd, meta.outDir), {recursive: true});
}

export function linkNodeModules(meta: BuildMeta): Promise<void> {
  return fs.promises
    .symlink(
      path.join(meta.cwd, "node_modules"),
      path.join(meta.cwd, meta.outDir, "node_modules"),
      "dir"
    )
    .catch(e => {
      if (e.code == "EEXIST") {
        return;
      }
      return Promise.reject(e);
    });
}
