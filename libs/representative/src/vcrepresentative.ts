import {Injectable} from "@nestjs/common";
import fs from "fs";
import path from "path";
import {
  IRepresentativeManager,
  RepresentativeManagerResource
} from "@spica-server/interface/representative";
import chokidar from "chokidar";
import {Observable, Subscriber} from "rxjs";
import {ChangeTypes, RepChange, ResourceType} from "@spica-server/interface/versioncontrol";

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

  // delete later
  async read() {
    return [];
  }

  startRealWatcher(
    moduleDir: string,
    subscriber: Subscriber<RepChange<RepresentativeManagerResource>>,
    bootstrapWatcher?: chokidar.FSWatcher
  ) {
    const watcher = chokidar.watch(moduleDir, {
      ignored: /(^|[/\\])\../,
      persistent: true
    });

    watcher.on("all", (event, path) => {
      let changeType: ChangeTypes;
      let resource: RepresentativeManagerResource;

      const relativePath = path.slice(moduleDir.length + 1);
      const _id = relativePath?.split("/")[0];

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
    bootstrapWatcher?.close();

    return () => watcher.close();
  }

  watch(module: string) {
    const moduleDir = this.getModuleDir(module);

    return new Observable<RepChange<RepresentativeManagerResource>>(subscriber => {
      if (fs.existsSync(moduleDir)) {
        return this.startRealWatcher(moduleDir, subscriber);
      }

      const bootstrapWatcher = chokidar.watch(this.cwd, {
        ignored: /(^|[/\\])\../,
        persistent: true,
        depth: 1
      });

      bootstrapWatcher.on("addDir", createdPath => {
        if (createdPath === moduleDir) {
          bootstrapWatcher.close();
          return this.startRealWatcher(moduleDir, subscriber, bootstrapWatcher);
        }
      });

      bootstrapWatcher.on("error", error => subscriber.error(error));

      return () => bootstrapWatcher.close();
    });
  }
}
