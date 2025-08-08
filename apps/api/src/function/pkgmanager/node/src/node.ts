import {PackageManager} from "../..";
import fs from "fs";
import path from "path";
import fastGlob from "fast-glob";
import {Package} from "../../../../../../../libs/interface/function/pkgmanager";

export abstract class NodePackageManager extends PackageManager {
  private readonly MAX_DEP_TYPE_SIZE_MB = 5;

  ls(cwd: string, includeTypes?: boolean): Promise<Package[]> {
    return fs.promises
      .readFile(path.join(cwd, "package.json"))
      .then(async buffer => {
        const packageJson = JSON.parse(buffer.toString());
        const dependencies = packageJson.dependencies || {};

        const packages = new Array<Package>();
        for (const depName of Object.keys(dependencies)) {
          let types = {};

          if (includeTypes) {
            types = await this.findTypes(cwd, depName);
          }

          packages.push({name: depName, version: dependencies[depName], types});
        }
        return packages;
      })
      .catch(e => {
        // Function has no package.json file.
        if (e.code == "ENOENT") {
          return [];
        }
        return Promise.reject(e);
      });
  }

  findTypes(cwd: string, depName: string) {
    let typeFiles = fastGlob.sync(`node_modules/${depName}/**/*.d.ts`, {cwd});
    const promises: Promise<{[file: string]: string}>[] = [];

    const size = this.calculateFileSizesMb(typeFiles, cwd);

    if (size > this.MAX_DEP_TYPE_SIZE_MB) {
      return Promise.resolve({});
    }

    for (const file of typeFiles) {
      promises.push(
        fs.promises.readFile(path.join(cwd, file)).then(b => {
          return {
            [file]: b.toString()
          };
        })
      );
    }

    return Promise.all(promises).then(files => {
      return files.reduce((acc, curr) => {
        acc = {...acc, ...curr};
        return acc;
      }, {});
    });
  }

  calculateFileSizesMb(files: string[], cwd: string) {
    return (
      files.reduce((acc, curr) => acc + fs.statSync(path.join(cwd, curr)).size, 0) / (1024 * 1024)
    );
  }
}
