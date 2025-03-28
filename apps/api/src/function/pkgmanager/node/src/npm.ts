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
        ["install", ...qualifiedNames, "--no-audit", "--loglevel", "verbose"],
        {cwd}
      );
      let stderr: string = "",
        stdout: string = "";

      let progress = 1;

      proc.stdout.on("data", chunk => {
        chunk = chunk.toString();
        stdout += chunk;
      });
      proc.stderr.on("data", chunk => {
        chunk = chunk.toString();

        const stages = [
          "npm verbose cli",
          "npm verbose title",
          "npm verbose argv",
          "npm http fetch",
          "npm verbose reify",
          "npm verbose cwd",
          "npm verbose exit"
        ];

        const index = stages.findIndex(stage => chunk.includes(stage));
        if (index !== -1) {
          const currentStage = Math.ceil(((index + 1) / stages.length) * 100);
          progress = progress > currentStage ? progress : currentStage;
        }

        observer.next(progress);

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
    });
  }
}
