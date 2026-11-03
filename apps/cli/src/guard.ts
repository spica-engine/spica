import fs from "fs";
import os from "os";
import path from "path";

export namespace guard {
  export interface Guard {
    path: string;
    folders: string[];
  }

  export function filePath() {
    return path.join(os.homedir(), ".spicaguard");
  }

  export function load(): Guard | undefined {
    const file = filePath();
    if (!fs.existsSync(file)) {
      return undefined;
    }

    return JSON.parse(fs.readFileSync(file).toString());
  }

  export function save(data: Guard) {
    fs.writeFileSync(filePath(), JSON.stringify(data, undefined, 2));
  }

  export function remove(): boolean {
    const file = filePath();
    if (!fs.existsSync(file)) {
      return false;
    }

    fs.unlinkSync(file);
    return true;
  }

  export function missingFolders(dir: string, folders: string[]) {
    return folders.filter(name => {
      try {
        return !fs.statSync(path.join(dir, name)).isDirectory();
      } catch {
        return true;
      }
    });
  }

  function realPath(p: string) {
    try {
      return fs.realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  }

  /**
   * Throws when a guard is set and plan/apply is not run from the guarded directory,
   * or when one of the guard's required folders is missing. Does nothing when no guard is set.
   */
  export function assert(rootDir: string) {
    const current = load();
    if (!current) {
      return;
    }

    const required = realPath(current.path);
    for (const dir of [process.cwd(), rootDir]) {
      if (realPath(dir) !== required) {
        throw new Error(
          `Invalid working directory: "${dir}". This command must be run from "${current.path}".\n` +
            `Run "spica guard show" to see the current guard settings.`
        );
      }
    }

    const folders = current.folders ?? [];
    const missing = missingFolders(rootDir, folders);
    if (missing.length) {
      throw new Error(
        `Invalid project structure in "${rootDir}". Missing required folder(s): ${missing.join(", ")}. Expected: ${folders.join(", ")}.`
      );
    }
  }
}
