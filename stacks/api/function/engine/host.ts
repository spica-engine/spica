import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import {Dependency, Function} from "./interface";

export abstract class FunctionHost<T = object> {
  abstract read(fn: T): string;
  abstract update(fn: T, template: TemplateStringsArray | string);
  abstract create(fn: T, template: TemplateStringsArray | string);
  abstract delete(fn: T);
  abstract getDependencies(fn: T);
  abstract addDependency(fn: T, dependency: string);
  abstract deleteDependency(fn: T, dependency: string);
  abstract getRoot(fn: T): string;
}

export class FsHost implements FunctionHost<Function> {
  constructor(private root: string) {}

  read(fn: Function) {
    return fs.readFileSync(path.join(this.getRoot(fn), "index.ts")).toString();
  }

  update(fn: Function, template: string | TemplateStringsArray) {
    const root = this.getRoot(fn);
    fs.writeFileSync(path.join(root, "index.ts"), template);
  }

  // TODO: Use async fs
  create(fn: Function, template: string | TemplateStringsArray) {
    const root = this.getRoot(fn);
    try {
      fs.mkdirSync(root, {recursive: true});
    } catch (e) {
      console.debug("TODO: FsFunctionHost.create");
    }

    if (!fs.existsSync(path.join(root, "index.ts"))) {
      fs.writeFileSync(path.join(root, "index.ts"), template);
    }
    if (!fs.existsSync(path.join(root, "package.json"))) {
      fs.writeFileSync(
        path.join(root, "package.json"),
        `{
          "name": "${fn._id}",
          "version": "0.0.0",
          "private": true,
          "dependencies": {}
        }`
      );
    }
  }

  delete(fn: Function) {
    this.deleteFolderRecursive(this.getRoot(fn));
  }

  addDependency(fn: Function, dependency: string) {
    const root = this.getRoot(fn);
    return new Promise((resolve, reject) => {
      const proc = child_process.spawn("npm", ["install", dependency], {cwd: root});
      proc.on("close", code => {
        if (code == 0) {
          return resolve();
        }
        reject(`Installation failed. Code: ${code}`);
      });
    });
  }

  getDependencies(fn: Function): Promise<Dependency> {
    const root = this.getRoot(fn);
    return fs.promises.readFile(path.join(root, "package.json")).then(buffer => {
      const packageJson = JSON.parse(buffer.toString());
      return packageJson.dependencies;
    });
  }

  deleteDependency(fn: Function, dependency: string): Promise<any> {
    const root = this.getRoot(fn);
    return new Promise((resolve, reject) => {
      const proc = child_process.spawn("npm", ["uninstall", dependency], {cwd: root});
      proc.on("close", code => {
        if (code == 0) {
          return resolve();
        }
        reject(`Uninstall failed. Code: ${code}`);
      });
    });
  }

  getRoot(fn: Function): string {
    return path.join(this.root, fn._id.toString());
  }

  protected deleteFolderRecursive(path: string) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach(file => {
        var curPath = path + "/" + file;
        if (fs.lstatSync(curPath).isDirectory()) {
          this.deleteFolderRecursive(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  }
}
