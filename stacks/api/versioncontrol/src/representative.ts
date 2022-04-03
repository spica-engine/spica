import {Inject, Injectable} from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import * as YAML from "yaml";
import {IRepresentativeManager, WORKING_DIR} from "./interface";

@Injectable()
export class RepresentativeManager implements IRepresentativeManager {
  private serializer = new Map<string, (val: any) => string>();
  private parsers = new Map<string, (val: string) => any>();

  constructor(@Inject(WORKING_DIR) private cwd: string) {
    // JSON
    this.serializer.set("json", val => JSON.stringify(val));
    this.parsers.set("json", val => JSON.parse(val));

    // YAML
    this.serializer.set("yaml", val => {
      const document = new YAML.Document();
      document.contents = val;
      return document.toString();
    });
    this.parsers.set("yaml", val => YAML.parse(val));

    // JS/TS
    this.serializer.set("js", val => val);
    this.parsers.set("js", val => val);
    this.serializer.set("ts", val => val);
    this.parsers.set("ts", val => val);
  }

  private getModuleDir(module: string) {
    return path.join(this.cwd, module);
  }

  private serializeContent(content: any, extension: string) {
    const serializer = this.serializer.get(extension);
    if (!serializer) {
      throw Error(`Unknown extension type ${extension}`);
    }

    return serializer(content);
  }

  private parseContent(content: string, extension: string) {
    const parser = this.parsers.get(extension);
    if (!parser) {
      throw Error(`Unknown extension type ${extension}`);
    }

    return parser(content);
  }

  write(module: string, id: string, fileName: string, content: any, extension: string) {
    const resourcesDirectory = path.join(this.cwd, module, id);
    if (!fs.existsSync(resourcesDirectory)) {
      fs.mkdirSync(resourcesDirectory, {recursive: true});
    }

    const fullPath = path.join(resourcesDirectory, `${fileName}.${extension}`);

    content = this.serializeContent(content, extension);

    return fs.promises.writeFile(fullPath, content).then(() => console.log(fullPath, content));
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

      const promise = fs.promises.readFile(resourcePath).then(content => {
        const extension = resource.split(".").pop();

        const key = resource.replace(`.${extension}`, "");
        const value = this.parseContent(content.toString(), extension);

        contents[key] = value;
      });

      promises.push(promise);
    }

    return Promise.all(promises).then(() => contents);
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

      const promise = this.readResource(module, id, fileNameFilter).then(contents => {
        if (Object.keys(contents).length) {
          const result = {
            _id: id,
            contents
          };
          results.push(result);
        }
      });

      promises.push(promise);
    }

    return Promise.all(promises).then(() => results);
  }

  delete(module: string, id: string) {
    const dir = path.join(this.getModuleDir(module), id);
    return fs.promises.rmdir(dir, {recursive: true});
  }
}
