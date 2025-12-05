import {Injectable} from "@nestjs/common";
import fs from "fs";
import path from "path";
import {
  IRepresentativeManager,
  RepresentativeFileEvent
} from "@spica-server/interface/representative";
import chokidar from "chokidar";
import {Observable} from "rxjs";
import {ChangeType} from "@spica-server/interface/versioncontrol";

@Injectable()
export class VCRepresentativeManager implements IRepresentativeManager {
  constructor(protected cwd: string) {
    try {
      const entries = fs.readdirSync(this.cwd);
      for (const entry of entries) {
        if (entry.startsWith(".")) continue;
        fs.rmSync(path.join(this.cwd, entry), {
          recursive: true,
          force: true
        });
      }
    } catch (error) {
      console.error("Error emptying representative directory:", error);
    }
  }

  getModuleDir(module: string) {
    return path.join(this.cwd, module);
  }

  write(
    module: string,
    id: string,
    fileName: string,
    content: string,
    extension: string,
    accessMode: "readwrite" | "readonly" = "readwrite"
  ) {
    const resourcesDirectory = path.join(this.cwd, module, id);
    if (!fs.existsSync(resourcesDirectory)) {
      fs.mkdirSync(resourcesDirectory, {recursive: true});
    }

    const fullPath = path.join(resourcesDirectory, `${fileName}.${extension}`);

    const writeFile = async () => {
      await fs.promises.writeFile(fullPath, content);

      if (accessMode == "readonly") {
        fs.chmodSync(fullPath, 0o644);
      }
    };

    return writeFile();
  }

  createModuleDirectory(path: string) {
    if (fs.existsSync(path)) {
      fs.rmSync(path, {recursive: true, force: true});
    }
    fs.mkdirSync(path, {recursive: true});
  }

  read(module: string, id: string, fileName: string) {
    const fullPath = path.join(this.getModuleDir(module), id, fileName);
    return fs.promises.readFile(fullPath, "utf-8");
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

  watch(module: string, files: string[], events: string[] = ["add", "change", "unlink"]) {
    const moduleDir = this.getModuleDir(module);

    this.createModuleDirectory(moduleDir);

    return new Observable<RepresentativeFileEvent>(subscriber => {
      const watcher = chokidar.watch(moduleDir, {
        ignored: /(^|[/\\])\../,
        persistent: true,
        depth: 2
      });

      watcher.on("all", async (event, path) => {
        const isTrackedEvent = events.includes(event);
        if (!isTrackedEvent) return;

        const relativePath = path.slice(moduleDir.length + 1);
        const parts = relativePath.split(/[/\\]/);

        const isCorrectDepth = parts.length == 2;
        const isTrackedFile = files.some(file => parts[1] == file);
        if (!isCorrectDepth || !isTrackedFile) return;

        const extension = parts[1].split(".").at(-1);

        let repFileEvent: RepresentativeFileEvent;

        switch (event) {
          case "add":
            repFileEvent = {
              content: await this.read(module, parts[0], parts[1]),
              slug: parts[0],
              extension,
              type: ChangeType.CREATE
            };
            break;

          case "change":
            repFileEvent = {
              content: await this.read(module, parts[0], parts[1]),
              slug: parts[0],
              extension,
              type: ChangeType.UPDATE
            };
            break;

          case "unlink":
            repFileEvent = {
              content: null,
              slug: parts[0],
              extension,
              type: ChangeType.DELETE
            };
            break;

          default:
            return;
        }

        subscriber.next(repFileEvent);
      });

      watcher.on("error", err => subscriber.error(err));

      return () => watcher.close();
    });
  }
}
