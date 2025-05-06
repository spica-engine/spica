import {Injectable} from "@nestjs/common";
import fs from "fs";
import path from "path";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {watch} from "chokidar";

@Injectable()
export class VCRepresentativeManager implements IRepresentativeManager {
  constructor(protected cwd: string) {}

  private getModuleDir(module: string) {
    return path.join(this.cwd, module);
  }

  write(module: string, id: string, fileName: string, content: any, extension: string) {
    const resourcesDirectory = path.join(this.cwd, module, id);
    if (!fs.existsSync(resourcesDirectory)) {
      fs.mkdirSync(resourcesDirectory, {recursive: true});
    }

    const fullPath = path.join(resourcesDirectory, `${fileName}.${extension}`);

    return fs.promises.writeFile(fullPath, content);
  }

  readResource(module: string, id: string, fileNames = []): Promise<any> {
    const moduleDir = this.getModuleDir(module);

    const resourcesPath = path.join(moduleDir, id);

    const contents = {};

    if (!fs.existsSync(resourcesPath)) {
      return Promise.resolve(contents);
    }

    let resources = fs.readdirSync(resourcesPath);

    if (fileNames.length) {
      resources = resources.filter(resource => fileNames.includes(resource));
    }

    const promises: Promise<any>[] = [];

    for (const resource of resources) {
      const resourcePath = path.join(resourcesPath, resource);

      const promise = fs.promises.readFile(resourcePath);
      promises.push(promise);
    }

    return Promise.all(promises).then(() => {
      return {_id: id, contents};
    });
  }

  read(module: string, resNameValidator: (name: string) => boolean, fileNameFilter = []) {
    const moduleDir = this.getModuleDir(module);

    let ids;

    if (!fs.existsSync(moduleDir)) {
      ids = [];
    } else {
      ids = fs.readdirSync(moduleDir);
    }

    const promises = [];
    const results = [];

    for (const id of ids) {
      if (!resNameValidator(id)) {
        continue;
      }

      const promise = this.readResource(module, id, fileNameFilter).then(resource => {
        if (resource.contents && Object.keys(resource.contents).length) {
          results.push(resource);
        }
      });

      promises.push(promise);
    }

    return Promise.all(promises).then(() => results);
  }

  rm(module?: string, id?: string) {
    let dir = this.cwd;

    if (module) {
      dir = path.join(dir, module);
    }

    if (id) {
      dir = path.join(dir, id);
    }

    return fs.promises.rm(dir, {recursive: true});
  }

  watch() {
    watch(this.cwd).on("all", (event, path) => {
      console.log(event, path);
    });
  }
}
