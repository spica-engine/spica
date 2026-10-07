import {Inject, Injectable} from "@nestjs/common";
import {randomBytes} from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import {rimraf} from "rimraf";
import {Function, Options, FUNCTION_OPTIONS} from "@spica-server/interface-function";
import {FUNCTION_ASSET_FILENAMES} from "@spica-server/interface-function-asset-storage";
import {pathExists} from "./fs-utils.js";

const MARKER_FILENAME = ".spica-artifact";
const TRASH_TTL_MS = 10 * 60 * 1000;
const SCRATCH_TTL_MS = 60 * 60 * 1000;

type ScratchKind = "tmp" | "staging" | "trash";

function uniqueName(fn: Function): string {
  return `${fn.name}.${Date.now()}.${randomBytes(4).toString("hex")}`;
}

@Injectable()
export class ArtifactWorkspace {
  private readonly scratchRoot: string;
  private cleared: Promise<void> | undefined;

  constructor(@Inject(FUNCTION_OPTIONS) private readonly options: Options) {
    // One directory per pod (the hostname is the pod name): on a shared ReadWriteMany disk,
    // clearing leftovers at startup must not remove another pod's in-flight downloads.
    this.scratchRoot = path.join(path.dirname(options.root), ".function-artifacts", os.hostname());
  }

  functionDir(fn: Function): string {
    return path.join(this.options.root, fn.name);
  }

  async matches(fn: Function, key: string): Promise<boolean> {
    const marker = await fs.promises
      .readFile(path.join(this.functionDir(fn), MARKER_FILENAME), "utf-8")
      .catch(() => null);
    return marker?.trim() === key;
  }

  async markBuilt(dir: string, key: string): Promise<void> {
    await fs.promises.writeFile(path.join(dir, MARKER_FILENAME), key);
  }

  async newTempFile(fn: Function): Promise<string> {
    return path.join(await this.scratchDir("tmp"), `${uniqueName(fn)}.tar.gz`);
  }

  async newStagingDir(fn: Function): Promise<string> {
    const dir = path.join(await this.scratchDir("staging"), uniqueName(fn));
    await fs.promises.mkdir(dir);
    return dir;
  }

  async copySourcesInto(fn: Function, staging: string): Promise<void> {
    for (const filename of FUNCTION_ASSET_FILENAMES) {
      const source = path.join(this.functionDir(fn), filename);
      const target = path.join(staging, filename);
      if ((await pathExists(source)) && !(await pathExists(target))) {
        await fs.promises.copyFile(source, target);
      }
    }
  }

  // Workers resolve code by path, so the tree is swapped in with two renames instead of being
  // extracted in place: no worker can ever load a half-extracted node_modules. The old tree goes
  // to trash rather than being deleted because outdated workers may still have it as their cwd.
  async swapIn(fn: Function, staging: string): Promise<void> {
    const dir = this.functionDir(fn);
    const trash = path.join(await this.scratchDir("trash"), uniqueName(fn));
    await fs.promises.mkdir(this.options.root, {recursive: true});
    const movedCurrent = await fs.promises.rename(dir, trash).then(
      () => true,
      e => {
        if (e.code === "ENOENT") return false;
        throw e;
      }
    );
    try {
      await fs.promises.rename(staging, dir);
    } catch (e) {
      if (movedCurrent) await fs.promises.rename(trash, dir).catch(() => undefined);
      throw e;
    }
    if (movedCurrent) {
      const now = new Date();
      await fs.promises.utimes(trash, now, now).catch(() => undefined);
    }
  }

  async discard(...targets: string[]): Promise<void> {
    await Promise.all(targets.map(target => rimraf(target).catch(() => false)));
  }

  async prune(now: number): Promise<void> {
    await this.pruneOlderThan("trash", now - TRASH_TTL_MS);
    await this.pruneOlderThan("tmp", now - SCRATCH_TTL_MS);
    await this.pruneOlderThan("staging", now - SCRATCH_TTL_MS);
  }

  private async pruneOlderThan(kind: ScratchKind, cutoff: number) {
    const dir = await this.scratchDir(kind);
    for (const entry of await fs.promises.readdir(dir)) {
      const target = path.join(dir, entry);
      const stat = await fs.promises.lstat(target).catch(() => null);
      if (stat && stat.mtimeMs < cutoff) await this.discard(target);
    }
  }

  // Leftovers from a previous process (a crash mid-restore) are cleared once, before first use,
  // so nothing still in use can be removed.
  private async scratchDir(kind: ScratchKind): Promise<string> {
    this.cleared ??= rimraf(this.scratchRoot).then(() => undefined);
    await this.cleared;
    const dir = path.join(this.scratchRoot, kind);
    await fs.promises.mkdir(dir, {recursive: true});
    return dir;
  }
}
