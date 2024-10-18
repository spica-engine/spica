import {Package, PackageManager} from "@spica-server/function/pkgmanager";
import * as child_process from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {Observable} from "rxjs";
import {glob} from "glob";

function getNpmPath() {
  let npmPath: string = "npm";

  // See: https://github.com/bazelbuild/rules_nodejs/issues/2197
  if (process.platform == "darwin") {
    const runfiles = require(process.env.BAZEL_NODE_RUNFILES_HELPER);
    npmPath = runfiles.resolve("nodejs_darwin_amd64/bin/npm");
  }

  return npmPath;
}

export class Npm extends PackageManager {
  private readonly MAX_DEP_TYPE_SIZE_MB = 5;

  install(cwd: string, qualifiedNames: string | string[]): Observable<number> {
    qualifiedNames = Array.isArray(qualifiedNames) ? qualifiedNames : [qualifiedNames];
    return new Observable(observer => {
      const proc = child_process.spawn(
        getNpmPath(),
        ["install", ...qualifiedNames, "--no-audit", "--loglevel", "timing"],
        {cwd}
      );
      let stderr: string = "",
        stdout: string = "";
      let progress = 1;
      const progressAmountOfAStep = 100 / 18;
      proc.stdout.on("data", chunk => {
        chunk = chunk.toString();
        stdout += chunk;
      });
      proc.stderr.on("data", chunk => {
        chunk = chunk.toString();

        if (chunk.indexOf("timing") != -1) {
          progress += 1;
        }

        observer.next(Math.min(Math.round(progressAmountOfAStep * progress), 100));

        stderr += chunk;
      });
      proc.on("close", code => {
        if (code == 0) {
          return observer.complete();
        }
        observer.error(`npm install has failed. code: ${code}\n${stderr}`);
      });

      return () => {
        if (!proc.killed) {
          proc.kill("SIGKILL");
        }
      };
    });
  }

  uninstall(cwd: string, name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = child_process.spawn(
        getNpmPath(),
        [
          "uninstall",
          name,
          "--no-audit",
          "--cache",
          path.join(os.tmpdir(), fs.mkdtempSync("_npm_cache_"))
        ],
        {cwd}
      );
      let stderr: string = "",
        stdout: string = "";
      proc.stdout.on("data", chunk => {
        chunk = chunk.toString();
        stdout += chunk;
      });
      proc.stderr.on("data", chunk => {
        chunk = chunk.toString();
        stderr += chunk;
      });
      proc.on("close", code => {
        if (code == 0) {
          return resolve();
        }
        reject(`npm uninstall has failed. code: ${code}\n${stderr}`);
      });
    });
  }

  ls(cwd: string): Promise<Package[]> {
    return fs.promises
      .readFile(path.join(cwd, "package.json"))
      .then(async buffer => {
        const packageJson = JSON.parse(buffer.toString());
        const dependencies = packageJson.dependencies || {};

        const packages = new Array<Package>();
        for (const depName of Object.keys(dependencies)) {
          const types = await this.findTypes(cwd, depName);
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
    let typeFiles = glob.sync(`node_modules/${depName}/**/*.d.ts`, {cwd});
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
