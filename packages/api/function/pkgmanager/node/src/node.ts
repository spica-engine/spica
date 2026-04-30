import fs from "fs";
import path from "path";
import {Package, PackageManager} from "@spica-server/interface-function-pkgmanager";

export abstract class NodePackageManager extends PackageManager {
  ls(cwd: string): Promise<Package[]> {
    return fs.promises
      .readFile(path.join(cwd, "package.json"))
      .then(buffer => {
        const packageJson = JSON.parse(buffer.toString());
        const dependencies = packageJson.dependencies || {};

        return Object.keys(dependencies).map(name => ({name, version: dependencies[name]}));
      })
      .catch(e => {
        // Function has no package.json file.
        if (e.code == "ENOENT") {
          return [];
        }
        return Promise.reject(e);
      });
  }
}
