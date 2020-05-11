import * as crypto from "crypto";
import {EventEmitter} from "events";
import * as fs from "fs";
import * as path from "path";
import * as rimraf from "rimraf";
import {Writable} from "stream";
import * as util from "util";
import {Compilation} from "./compilation";

export abstract class Runtime {
  abstract description: Description;
  abstract compile(compilation: Compilation): Promise<void>;
  abstract spawn(options: SpawnOptions): Worker;
  protected async prepare(compilation: Compilation): Promise<void> {
    return fs.promises.mkdir(path.join(compilation.cwd, ".build"), {recursive: true});
  }

  protected async rimraf(cwd: string): Promise<void> {
    const rmrf = util.promisify(rimraf);
    return rmrf(cwd, {});
  }

  protected async writeChecksum(compilation: Compilation): Promise<void> {
    const code = await fs.promises.readFile(path.join(compilation.cwd, compilation.entrypoint));
    const shasum = crypto.createHash("sha512");
    shasum.update(code);
    shasum.digest("hex").toString();
  }
}

export interface SpawnOptions {
  id: string;
  env: {
    [key: string]: string;
  };
}

export interface Description {
  name: string;
  title: string;
  description?: string;
}

export interface Execution {
  stdout: Writable | "ignore" | "inherit";
  env?: {
    [k: string]: string;
  };
  memoryLimit?: number;
  timeout?: number;
  cwd: string;
  eventId: string;
}

export abstract class Worker extends EventEmitter {
  abstract attach(stdout?: Writable, stderr?: Writable): void;
}
