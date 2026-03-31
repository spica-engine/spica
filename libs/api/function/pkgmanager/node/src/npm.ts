import child_process from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {Observable} from "rxjs";
import {NodePackageManager} from "./node";

function getNpmPath() {
  let npmPath: string = "npm";
  return npmPath;
}

export class Npm extends NodePackageManager {
  install(cwd: string, _qualifiedNames: string | string[]): Observable<number> {
    let qualifiedNames: string[] = this.normalizePackageNames(_qualifiedNames);

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

      proc.on("error", err => {
        observer.error(`npm install has failed. error: ${err.message}`);
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
          fs.mkdtempSync(path.join(os.tmpdir(), "_npm_cache_"))
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
      proc.on("error", err => {
        reject(`npm uninstall has failed. error: ${err.message}`);
      });
    });
  }
}
