import * as fs from "fs";
import * as path from "path";
import * as YAML from "yaml";

export class RepresentativeManager {
  private directory: string;
  constructor() {
    this.directory = path.join(process.cwd(), "representatives");
  }

  private getModuleDir(module: string) {
    return path.join(this.directory, module);
  }

  write(module: string, id: string, fileName: string, content: any, extension = "yaml") {
    const resourcesDirectory = path.join(this.directory, module, id);
    if (!fs.existsSync(resourcesDirectory)) {
      fs.mkdirSync(resourcesDirectory, {recursive: true});
    }

    const fullPath = path.join(resourcesDirectory, `${fileName}.${extension}`);

    const representative = new YAML.Document();
    representative.contents = content;

    return fs.promises.writeFile(fullPath, representative.toString());
  }

  read(module: string, id: string): Promise<any> {
    const moduleDir = this.getModuleDir(module);

    const resourcesPath = path.join(moduleDir, id);
    const resources = fs.readdirSync(resourcesPath);

    const contents = {};

    const promises: Promise<any>[] = [];

    for (const resource of resources) {
      const resourcePath = path.join(resourcesPath, resource);

      const promise = fs.promises.readFile(resourcePath).then(content => {
        const key = resource.substring(0, resource.indexOf("."));
        contents[key] = content.toString();
      });

      promises.push(promise);
    }

    return Promise.all(promises).then(() => contents);
  }

  // module_name/resource_id/schema.json
  // module_name/resource_id/index.js
  readAll(module: string) {
    const moduleDir = this.getModuleDir(module);
    const ids = fs.readdirSync(moduleDir);

    const promises = [];
    const results = [];

    for (const id of ids) {
      const promise = this.read(module, id).then(contents => {
        if (Object.keys(contents).length) {
          results.push(contents);
        }
      });

      promises.push(promise);
    }

    return Promise.all(promises).then(() => results);
  }

  delete(module: string) {
    const moduleDir = this.getModuleDir(module);
    return fs.promises.rmdir(moduleDir, {recursive: true});
  }
}
