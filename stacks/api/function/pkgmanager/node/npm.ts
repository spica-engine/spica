import {Package, PackageManager} from "@spica-server/function/pkgmanager";
import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";

export class Npm extends PackageManager {
  install(cwd: string, qualifiedName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = child_process.spawn("npm", ["install", qualifiedName], {cwd});
      proc.on("close", code => {
        if (code == 0) {
          return resolve();
        }
        reject(`npm install has failed. code: ${code}`);
      });
    });
  }

  uninstall(cwd: string, name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = child_process.spawn("npm", ["uninstall", name], {cwd});
      proc.on("close", code => {
        if (code == 0) {
          return resolve();
        }
        reject(`Uninstall failed. Code: ${code}`);
      });
    });
  }

  ls(cwd: string): Promise<Package[]> {
    return fs.promises
      .readFile(path.join(cwd, "package.json"))
      .then(buffer => {
        const packageJson = JSON.parse(buffer.toString());
        const dependencies = packageJson.dependencies || {};
        return Object.keys(dependencies).reduce((packages, depName) => {
          packages.push({
            name: depName,
            version: dependencies[depName]
          });
          return packages;
        }, new Array<Package>());
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
