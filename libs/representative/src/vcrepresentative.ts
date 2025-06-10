import {Injectable} from "@nestjs/common";
import fs from "fs";
import path from "path";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import chokidar from "chokidar";
import {Observable} from "rxjs";
import {
  ChangeTypes,
  RepChange,
  ResourceType,
  RepresentativeManagerResource
} from "@spica-server/interface/versioncontrol";

@Injectable()
export class VCRepresentativeManager implements IRepresentativeManager {
  constructor(protected cwd: string) {}

  private getModuleDir(module: string) {
    return path.join(this.cwd, module);
  }

  write(module: string, id: string, fileName: string, content: string, extension: string) {
    const resourcesDirectory = path.join(this.cwd, module, id);
    if (!fs.existsSync(resourcesDirectory)) {
      fs.mkdirSync(resourcesDirectory, {recursive: true});
    }

    const fullPath = path.join(resourcesDirectory, `${fileName}.${extension}`);
    return fs.promises.writeFile(fullPath, content);
  }

  createModuleDirectory(path: string) {
    if (fs.existsSync(path)) {
      fs.rmSync(path, {recursive: true, force: true});
    }
    fs.mkdirSync(path, {recursive: true});
  }

  readFile(path: string) {
    return fs.readFileSync(path, "utf-8");
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

  // for test use only
  async readResource(module: string, id: string): Promise<any> {
    const moduleDir = this.getModuleDir(module);

    const resourcesPath = path.join(moduleDir, id);

    const contents = {};

    if (!fs.existsSync(resourcesPath)) {
      return Promise.resolve(contents);
    }

    let resources = fs.readdirSync(resourcesPath);

    const promises: Promise<any>[] = [];

    for (const resource of resources) {
      const resourcePath = path.join(resourcesPath, resource);

      const promise = fs.promises.readFile(resourcePath).then(content => {
        const extension = resource.split(".").pop();

        const key = resource.replace(`.${extension}`, "");
        contents[key] = content.toString();
      });

      promises.push(promise);
    }

    await Promise.all(promises);
    return {_id: id, contents};
  }

  // delete later
  async read() {
    return [];
  }

  watch(module: string, files: string[], events: string[] = ["add", "change", "unlink"]) {
    const moduleDir = this.getModuleDir(module);

    this.createModuleDirectory(moduleDir);

    return new Observable<RepChange<RepresentativeManagerResource>>(subscriber => {
      const watcher = chokidar.watch(moduleDir, {
        ignored: /(^|[/\\])\../,
        persistent: true,
        depth: 2
      });

      watcher.on("all", (event, path) => {
        const isTrackedEvent = events.includes(event);
        if (!isTrackedEvent) return;

        const relativePath = path.slice(moduleDir.length + 1);
        const parts = relativePath.split(/[/\\]/);

        const isCorrectDepth = parts.length == 2;
        const isTrackedFile = files.some(file => parts[1] == file);
        if (!isCorrectDepth || !isTrackedFile) return;

        const _id = parts[0];

        let changeType: ChangeTypes;
        let resource: RepresentativeManagerResource;

        switch (event) {
          case "add":
            changeType = ChangeTypes.INSERT;
            resource = {_id, content: this.readFile(path)};
            break;

          case "change":
            changeType = ChangeTypes.UPDATE;
            resource = {_id, content: this.readFile(path)};
            break;

          case "unlink":
            changeType = ChangeTypes.DELETE;
            resource = {_id, content: ""};
            break;

          default:
            return;
        }

        const repChange: RepChange<RepresentativeManagerResource> = {
          resourceType: ResourceType.REPRESENTATIVE,
          changeType,
          resource
        };

        subscriber.next(repChange);
      });

      watcher.on("error", err => subscriber.error(err));

      return () => watcher.close();
    });
  }
}
