import {Injectable, Logger} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import {Function} from "@spica-server/interface-function";
import {AssetRecorder} from "../asset-recorder.js";
import {FunctionPreparationService} from "../function-preparation.service.js";
import {KeyedMutex} from "../keyed-mutex.js";
import {packDirectory, unpackArchive} from "./archive.js";
import {ArtifactDescriptor, ArtifactIdentity} from "./artifact-identity.js";
import {ArtifactStore} from "./artifact-store.js";
import {ArtifactWorkspace} from "./artifact-workspace.js";

const ARCHIVE_ENTRIES = [".build", "node_modules", "package.json", "package-lock.json"];

type FunctionWithId = Function & {_id: ObjectId};

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

@Injectable()
export class FunctionArtifactSync {
  private readonly logger = new Logger(FunctionArtifactSync.name);

  constructor(
    private readonly identity: ArtifactIdentity,
    private readonly workspace: ArtifactWorkspace,
    private readonly store: ArtifactStore,
    private readonly preparation: FunctionPreparationService,
    private readonly recorder: AssetRecorder,
    private readonly mutex: KeyedMutex
  ) {}

  publish(fn: FunctionWithId, opts: {buildFailed?: boolean} = {}): Promise<void> {
    return this.mutex.run(fn.name, () => this.publishUnlocked(fn, !!opts.buildFailed));
  }

  /** The caller must hold the function's lock (KeyedMutex) while the sources are synced. */
  async restoreOrBuild(fn: FunctionWithId, opts: {allowFallback: boolean}): Promise<boolean> {
    const descriptor = await this.identity.of(fn);
    if (await this.workspace.matches(fn, descriptor.key)) return false;
    if (await this.tryRestore(fn, descriptor.key)) return true;
    if (!opts.allowFallback) return false;

    this.logger.log(`[artifact] No usable archive for ${fn.name} — installing and building`);
    await this.preparation.installPackages(fn, []);
    if (descriptor.inputs.index) await this.preparation.build(fn);
    await this.publishUnlocked(fn, false);
    return true;
  }

  async delete(fn: FunctionWithId): Promise<void> {
    await this.store
      .deleteFor(fn)
      .catch(e =>
        this.logger.error(`[artifact] Could not delete archives of ${fn.name}: ${errMsg(e)}`)
      );
  }

  private async publishUnlocked(fn: FunctionWithId, buildFailed: boolean) {
    const descriptor = await this.describe(fn);
    if (!descriptor) return;
    if (buildFailed) return this.record(fn, descriptor, null);
    if (await this.workspace.matches(fn, descriptor.key)) return;

    const uploaded = await this.uploadArchive(fn, descriptor.key);
    await this.workspace.markBuilt(this.workspace.functionDir(fn), descriptor.key);
    await this.record(fn, descriptor, uploaded ? descriptor.key : null);
  }

  private async describe(fn: FunctionWithId): Promise<ArtifactDescriptor | null> {
    try {
      const lockfile = await this.preparation.readFileBuffer(fn, "package-lock.json");
      if (lockfile) await this.recorder.storeIfChanged(fn, "package-lock.json", lockfile);
      return await this.identity.of(fn);
    } catch (e) {
      this.logger.error(`[artifact] Could not prepare archive of ${fn.name}: ${errMsg(e)}`);
      return null;
    }
  }

  private async uploadArchive(fn: Function, key: string): Promise<boolean> {
    try {
      if (await this.store.has(key)) return true;
      const archive = await this.workspace.newTempFile(fn);
      try {
        await packDirectory(this.workspace.functionDir(fn), ARCHIVE_ENTRIES, archive);
        await this.store.upload(key, archive);
      } finally {
        await this.workspace.discard(archive);
      }
      return true;
    } catch (e) {
      this.logger.error(
        `[artifact] Upload of ${fn.name} failed, other replicas will install and build it: ${errMsg(e)}`
      );
      return false;
    }
  }

  private async tryRestore(fn: Function, key: string): Promise<boolean> {
    try {
      if (!(await this.store.has(key))) return false;
      await this.restore(fn, key);
      this.logger.log(`[artifact] Restored ${fn.name} from ${key}`);
      return true;
    } catch (e) {
      this.logger.error(`[artifact] Restore of ${fn.name} from ${key} failed: ${errMsg(e)}`);
      return false;
    }
  }

  private async restore(fn: Function, key: string) {
    const archive = await this.workspace.newTempFile(fn);
    const staging = await this.workspace.newStagingDir(fn);
    try {
      await this.store.download(key, archive);
      await unpackArchive(archive, staging);
      await this.workspace.copySourcesInto(fn, staging);
      await this.workspace.markBuilt(staging, key);
      await this.workspace.swapIn(fn, staging);
    } finally {
      await this.workspace.discard(archive, staging);
    }
  }

  private async record(fn: FunctionWithId, descriptor: ArtifactDescriptor, key: string | null) {
    await this.store
      .record(fn, descriptor, key)
      .catch(e =>
        this.logger.error(`[artifact] Could not record archive of ${fn.name}: ${errMsg(e)}`)
      );
  }
}
