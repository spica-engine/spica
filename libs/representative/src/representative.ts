import {Inject, Injectable, Scope} from "@nestjs/common";
import fs from "fs";
import path from "path";
import YAML from "yaml";
import dotenv from "dotenv";
import {IRepresentativeManager} from "../../interface/representative";
import {Observable} from "rxjs";
import {RepChange, RepresentativeManagerResource} from "../../interface/versioncontrol";

@Injectable()
export class RepresentativeManager implements IRepresentativeManager {
  private serializer = new Map<string, (val: any) => string>();
  private parsers = new Map<string, (val: string) => any>();

  constructor(protected cwd: string) {
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

    // .env
    this.serializer.set("env", content => {
      let lines = [];
      for (const [key, value] of Object.entries(content)) {
        lines.push(`${key}=${value}`);
      }
      return lines.join("\n");
    });
    this.parsers.set("env", content => {
      return dotenv.parse(content);
    });
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

      const promise = fs.promises.readFile(resourcePath).then(content => {
        const extension = resource.split(".").pop();

        const key = resource.replace(`.${extension}`, "");
        const value = this.parseContent(content.toString(), extension);

        contents[key] = value;
      });

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

  // delete later
  watch() {
    return new Observable<RepChange<RepresentativeManagerResource>>(observer => {});
  }
}
