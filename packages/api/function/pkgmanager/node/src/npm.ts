import child_process from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { NodePackageManager } from "./node.js";

function getNpmPath() {
  let npmPath: string = "npm";
  return npmPath;
}

export class Npm extends NodePackageManager {
  install(cwd: string, _qualifiedNames: string | string[]): Promise<void> {
    const qualifiedNames: string[] = this.normalizePackageNames(_qualifiedNames);

    return new Promise<void>((resolve, reject) => {
      const proc = child_process.spawn(
        getNpmPath(),
        ["install", ...qualifiedNames, "--no-audit"],
        { cwd, stdio: ["pipe", "ignore", "pipe"] }
      );
      let stderr: string = "";
      proc.stderr.on("data", chunk => {
        stderr += chunk.toString();
      });
      proc.on("close", code => {
        if (code == 0) {
          return resolve();
        }
        reject(`npm install has failed. code: ${code}\n${stderr}`);
      });

      proc.on("error", err => {
        reject(`npm install has failed. error: ${err.message}`);
      });
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
        { cwd }
      );
      let stderr: string = "";
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
