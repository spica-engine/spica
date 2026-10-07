import {Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit} from "@nestjs/common";
import {randomBytes} from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import * as tar from "tar";
import {rimraf} from "rimraf";
import {ObjectId} from "@spica-server/database";
import {FunctionArtifactService, FunctionAssetService} from "@spica-server/function-services";
import {Function, Options, FUNCTION_OPTIONS} from "@spica-server/interface-function";
import {
  FunctionArtifactInputs,
  FunctionAssetFilename,
  FunctionAssetStorageOptions,
  FunctionAssetStrategy,
  FUNCTION_ASSET_FILENAMES,
  FUNCTION_ASSET_STORAGE_OPTIONS,
  FUNCTION_ASSET_STRATEGY
} from "@spica-server/interface-function-asset-storage";
import {
  artifactKey,
  artifactPrefix,
  assetKey,
  hashBuffer,
  isArtifactKey,
  platformId
} from "./asset-keys.js";
import {SelfWriteTracker} from "./asset-write-tracker.js";
import {FunctionPreparationService} from "./function-preparation.service.js";

type FunctionWithId = Function & {_id: ObjectId};

export const ARTIFACT_STAMP_FILENAME = "artifact";
export const UNAVAILABLE_ARTIFACT_STAMP = "unavailable";

const MARKER_FILENAME = ".spica-artifact";
const ARCHIVE_ENTRIES = [".build", "node_modules", "package.json", "package-lock.json"];

const GC_GRACE_MS = 24 * 60 * 60 * 1000;
const GC_INITIAL_DELAY_MS = 5 * 60 * 1000;
const GC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const TRASH_TTL_MS = 10 * 60 * 1000;
const SCRATCH_TTL_MS = 60 * 60 * 1000;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function uniqueSuffix(): string {
  return `${Date.now()}.${randomBytes(4).toString("hex")}`;
}

function escapes(entryPath: string): boolean {
  const normalized = path.posix.normalize(entryPath);
  return path.posix.isAbsolute(normalized) || normalized.split("/").includes("..");
}

// preservePaths is required because node_modules holds symlinks that point outside the function
// directory (@spica-fn/* -> ../../../<sibling>, legacy .build/node_modules -> absolute path), but it
// also disables tar's own path checks. This filter restores them for everything except symlink
// targets: no absolute or parent-relative entry paths, no escaping hardlinks, and no entries
// written through a symlink extracted earlier from the same archive.
function safeEntryFilter() {
  const symlinks = new Set<string>();
  return (entryPath: string, entry: tar.ReadEntry | fs.Stats) => {
    if (!("type" in entry)) return false;
    const normalized = path.posix.normalize(entryPath).replace(/\/$/, "");
    if (escapes(normalized)) return false;
    if (entry.type == "Link" && escapes(entry.linkpath ?? "")) return false;
    const segments = normalized.split("/");
    for (let i = 1; i < segments.length; i++) {
      if (symlinks.has(segments.slice(0, i).join("/"))) return false;
    }
    if (entry.type == "SymbolicLink") symlinks.add(normalized);
    return true;
  };
}

async function pathExists(target: string): Promise<boolean> {
  return fs.promises.lstat(target).then(
    () => true,
    () => false
  );
}

@Injectable()
export class FunctionArtifactManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FunctionArtifactManager.name);
  private readonly platform = platformId();
  private readonly scratchRoot: string;
  private readonly locks = new Map<string, Promise<unknown>>();
  private gcTimer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(FUNCTION_ASSET_STRATEGY) private readonly strategy: FunctionAssetStrategy,
    @Inject(FUNCTION_ASSET_STORAGE_OPTIONS)
    private readonly storageOptions: FunctionAssetStorageOptions,
    @Inject(FUNCTION_OPTIONS) private readonly options: Options,
    private readonly artifactService: FunctionArtifactService,
    private readonly assetService: FunctionAssetService,
    private readonly preparationService: FunctionPreparationService,
    private readonly tracker: SelfWriteTracker
  ) {
    // Per host, because with a shared (ReadWriteMany) disk every replica would otherwise clear
    // the others' in-flight downloads on startup.
    this.scratchRoot = path.join(path.dirname(options.root), ".function-artifacts", os.hostname());
  }

  async onModuleInit() {
    await rimraf(this.scratchRoot);
    const jitter = Math.floor(Math.random() * GC_INITIAL_DELAY_MS);
    this.gcTimer = setTimeout(() => this.runGarbageCollection(), GC_INITIAL_DELAY_MS + jitter);
    this.gcTimer.unref();
  }

  onModuleDestroy() {
    clearTimeout(this.gcTimer);
  }

  runExclusive<T>(functionName: string, task: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(functionName) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    this.locks.set(functionName, next);
    next
      .catch(() => undefined)
      .finally(() => {
        if (this.locks.get(functionName) === next) this.locks.delete(functionName);
      });
    return next;
  }

  private async trackAsset(fn: FunctionWithId, filename: FunctionAssetFilename, data: Buffer) {
    const key = assetKey(fn.name, filename);
    const hash = hashBuffer(data);
    await this.strategy.write(key, data);
    this.tracker.stamp({functionId: fn._id.toHexString(), filename, hash});
    await this.assetService.upsertAsset(fn._id, filename, {
      key,
      hash,
      size: data.byteLength,
      uploadDate: new Date(),
      strategy: this.storageOptions.strategy
    });
  }

  async rebuild(fn: Function): Promise<boolean> {
    const index = await this.preparationService.readFileBuffer(
      fn,
      this.preparationService.indexFilename(fn)
    );
    if (!index) return true;
    try {
      await this.preparationService.build(fn);
      return true;
    } catch (e) {
      this.logger.error(
        `[artifact] Build after dependency change failed for ${fn.name}: ${errMsg(e)}`
      );
      return false;
    }
  }

  publish(fn: FunctionWithId, opts: {buildFailed?: boolean} = {}): Promise<void> {
    return this.runExclusive(fn.name, () => this.publishUnlocked(fn, opts));
  }

  /**
   * Must run inside runExclusive for the function. Brings the local tree in line with the
   * source files already synced to disk: a no-op when the marker matches, otherwise restore the
   * archive or, with allowFallback, install + build locally and publish the result.
   */
  async restoreOrBuild(fn: FunctionWithId, opts: {allowFallback: boolean}): Promise<boolean> {
    const inputs = await this.computeInputs(fn);
    const key = artifactKey(fn.name, inputs, this.platform);
    if ((await this.readMarker(fn)) === key) return false;

    const available = await this.strategy.exists(key).catch(e => {
      this.logger.error(`[artifact] Could not look up ${key}: ${errMsg(e)}`);
      return false;
    });
    if (available) {
      try {
        await this.restore(fn, key);
        this.logger.log(`[artifact] Restored ${fn.name} from ${key}`);
        return true;
      } catch (e) {
        this.logger.error(`[artifact] Restore of ${fn.name} from ${key} failed: ${errMsg(e)}`);
      }
    }

    if (!opts.allowFallback) return false;

    this.logger.log(`[artifact] No usable archive for ${fn.name} — installing and building`);
    await this.preparationService.installPackages(fn, []);
    if (inputs.index) {
      await this.preparationService.build(fn);
    }
    await this.publishUnlocked(fn, {});
    return true;
  }

  async deleteArtifacts(fn: FunctionWithId): Promise<void> {
    try {
      const objects = await this.strategy.list(artifactPrefix(fn.name));
      await Promise.all(objects.map(object => this.strategy.delete(object.key)));
      await this.artifactService.deleteByFunction(fn._id);
    } catch (e) {
      this.logger.error(`[artifact] Could not delete archives of ${fn.name}: ${errMsg(e)}`);
    }
  }

  async collectGarbage(now = Date.now()): Promise<void> {
    const referenced = await this.artifactService.findReferencedKeys();
    const objects = await this.strategy.list("functions/");
    const unreferenced = objects.filter(
      object =>
        isArtifactKey(object.key) &&
        !referenced.has(object.key) &&
        object.lastModified.getTime() < now - GC_GRACE_MS
    );
    for (const object of unreferenced) {
      await this.strategy
        .delete(object.key)
        .catch(e => this.logger.error(`[artifact] Could not delete ${object.key}: ${errMsg(e)}`));
    }
    if (unreferenced.length) {
      this.logger.log(`[artifact] Deleted ${unreferenced.length} unreferenced archive(s)`);
    }

    await this.pruneScratch("trash", TRASH_TTL_MS, now);
    await this.pruneScratch("tmp", SCRATCH_TTL_MS, now);
    await this.pruneScratch("staging", SCRATCH_TTL_MS, now);
  }

  private runGarbageCollection() {
    this.collectGarbage()
      .catch(e => this.logger.error(`[artifact] Garbage collection failed: ${errMsg(e)}`))
      .finally(() => {
        this.gcTimer = setTimeout(() => this.runGarbageCollection(), GC_INTERVAL_MS);
        this.gcTimer.unref();
      });
  }

  private async publishUnlocked(fn: FunctionWithId, opts: {buildFailed?: boolean}) {
    let inputs: FunctionArtifactInputs;
    let key: string;
    try {
      await this.trackLockfile(fn);
      inputs = await this.computeInputs(fn);
      key = artifactKey(fn.name, inputs, this.platform);
    } catch (e) {
      this.logger.error(`[artifact] Could not prepare archive of ${fn.name}: ${errMsg(e)}`);
      return;
    }

    if (opts.buildFailed) {
      await this.recordArtifact(fn, null, inputs);
      return;
    }

    if ((await this.readMarker(fn)) === key) return;

    let published: string | null = key;
    try {
      if (!(await this.strategy.exists(key))) {
        const archive = await this.pack(fn);
        try {
          await this.strategy.upload(key, archive);
        } finally {
          await fs.promises.rm(archive, {force: true});
        }
      }
    } catch (e) {
      this.logger.error(
        `[artifact] Upload of ${fn.name} failed, other replicas will install and build it: ${errMsg(e)}`
      );
      published = null;
    }

    await this.writeMarker(this.functionDir(fn), key);
    await this.recordArtifact(fn, published, inputs);
  }

  private async recordArtifact(
    fn: FunctionWithId,
    key: string | null,
    inputs: FunctionArtifactInputs
  ) {
    try {
      this.tracker.stamp({
        functionId: fn._id.toHexString(),
        filename: ARTIFACT_STAMP_FILENAME,
        hash: key ?? UNAVAILABLE_ARTIFACT_STAMP
      });
      await this.artifactService.upsertArtifact(fn._id, this.platform, {
        key,
        inputs,
        uploadDate: new Date()
      });
    } catch (e) {
      this.logger.error(`[artifact] Could not record archive of ${fn.name}: ${errMsg(e)}`);
    }
  }

  private async trackLockfile(fn: FunctionWithId) {
    const local = await this.preparationService.readFileBuffer(fn, "package-lock.json");
    if (!local) return;
    const record = await this.assetService.findByFilename(fn._id, "package-lock.json");
    if (record?.hash === hashBuffer(local)) return;
    await this.trackAsset(fn, "package-lock.json", local);
  }

  private async computeInputs(fn: Function): Promise<FunctionArtifactInputs> {
    const [index, packageJson, lockfile] = await Promise.all(
      [this.preparationService.indexFilename(fn), "package.json", "package-lock.json"].map(
        filename => this.preparationService.readFileBuffer(fn, filename)
      )
    );
    return {
      index: index ? hashBuffer(index) : null,
      packageJson: packageJson ? hashBuffer(packageJson) : null,
      lockfile: lockfile ? hashBuffer(lockfile) : null,
      builder: this.options.builder ?? "legacy"
    };
  }

  private async pack(fn: Function): Promise<string> {
    const dir = this.functionDir(fn);
    const entries: string[] = [];
    for (const entry of ARCHIVE_ENTRIES) {
      if (await pathExists(path.join(dir, entry))) entries.push(entry);
    }
    const file = path.join(this.scratchDir("tmp"), `${fn.name}.${uniqueSuffix()}.tar.gz`);
    await fs.promises.mkdir(path.dirname(file), {recursive: true});
    await tar.c({gzip: true, cwd: dir, file, portable: true}, entries);
    return file;
  }

  private async restore(fn: Function, key: string) {
    const dir = this.functionDir(fn);
    const suffix = uniqueSuffix();
    const archive = path.join(this.scratchDir("tmp"), `${fn.name}.${suffix}.tar.gz`);
    const staging = path.join(this.scratchDir("staging"), `${fn.name}.${suffix}`);
    await fs.promises.mkdir(path.dirname(archive), {recursive: true});
    await fs.promises.mkdir(staging, {recursive: true});
    try {
      await this.strategy.download(key, archive);
      await tar.x({file: archive, cwd: staging, preservePaths: true, filter: safeEntryFilter()});
      for (const filename of FUNCTION_ASSET_FILENAMES) {
        const source = path.join(dir, filename);
        const target = path.join(staging, filename);
        if ((await pathExists(source)) && !(await pathExists(target))) {
          await fs.promises.copyFile(source, target);
        }
      }
      await this.writeMarker(staging, key);
      await this.swap(fn, dir, staging, suffix);
    } finally {
      await fs.promises.rm(archive, {force: true});
      await rimraf(staging);
    }
  }

  // Workers resolve code by path, so the tree is swapped in with two renames instead of being
  // extracted in place: no worker can ever load a half-extracted node_modules. The old tree goes
  // to trash rather than being deleted because outdated workers may still have it as their cwd.
  private async swap(fn: Function, dir: string, staging: string, suffix: string) {
    const trash = path.join(this.scratchDir("trash"), `${fn.name}.${suffix}`);
    await fs.promises.mkdir(path.dirname(trash), {recursive: true});
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

  private async pruneScratch(kind: string, ttl: number, now: number) {
    const dir = this.scratchDir(kind);
    const entries = await fs.promises.readdir(dir).catch(() => [] as string[]);
    for (const entry of entries) {
      const target = path.join(dir, entry);
      const stat = await fs.promises.lstat(target).catch(() => null);
      if (stat && stat.mtimeMs < now - ttl) {
        await rimraf(target).catch(() => undefined);
      }
    }
  }

  private async readMarker(fn: Function): Promise<string | null> {
    return fs.promises.readFile(path.join(this.functionDir(fn), MARKER_FILENAME), "utf-8").then(
      content => content.trim(),
      () => null
    );
  }

  private writeMarker(dir: string, key: string) {
    return fs.promises.writeFile(path.join(dir, MARKER_FILENAME), key);
  }

  private functionDir(fn: Function): string {
    return path.join(this.options.root, fn.name);
  }

  private scratchDir(kind: string): string {
    return path.join(this.scratchRoot, kind);
  }
}
