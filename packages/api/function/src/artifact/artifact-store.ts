import {Inject, Injectable} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import {FunctionArtifactService} from "@spica-server/function-services";
import {Function} from "@spica-server/interface-function";
import {
  FunctionArtifact,
  FunctionAssetStrategy,
  FUNCTION_ASSET_STRATEGY
} from "@spica-server/interface-function-asset-storage";
import {SelfWriteTracker} from "../asset-write-tracker.js";
import {ArtifactDescriptor} from "./artifact-identity.js";
import {artifactPrefix, isArtifactKey} from "./artifact-key.js";

const STAMP_FILENAME = "artifact";
const UNAVAILABLE_STAMP = "unavailable";

type FunctionWithId = Function & {_id: ObjectId};

@Injectable()
export class ArtifactStore {
  constructor(
    @Inject(FUNCTION_ASSET_STRATEGY) private readonly strategy: FunctionAssetStrategy,
    private readonly artifactService: FunctionArtifactService,
    private readonly tracker: SelfWriteTracker
  ) {}

  has(key: string): Promise<boolean> {
    return this.strategy.exists(key);
  }

  upload(key: string, file: string): Promise<void> {
    return this.strategy.upload(key, file);
  }

  download(key: string, file: string): Promise<void> {
    return this.strategy.download(key, file);
  }

  delete(key: string): Promise<void> {
    return this.strategy.delete(key);
  }

  async record(
    fn: FunctionWithId,
    descriptor: ArtifactDescriptor,
    archiveKey: string | null
  ): Promise<void> {
    this.tracker.stamp(this.stampOf(fn._id, archiveKey));
    await this.artifactService.upsertArtifact(fn._id, descriptor.platform, {
      key: archiveKey,
      inputs: descriptor.inputs,
      uploadDate: new Date()
    });
  }

  isSelfWrite(artifact: Pick<FunctionArtifact, "functionId" | "key">): boolean {
    return this.tracker.isSelfWrite(this.stampOf(artifact.functionId, artifact.key));
  }

  async deleteFor(fn: FunctionWithId): Promise<void> {
    const objects = await this.strategy.list(artifactPrefix(fn.name));
    await Promise.all(objects.map(object => this.strategy.delete(object.key)));
    await this.artifactService.deleteByFunction(fn._id);
  }

  async findUnreferenced(modifiedBefore: number): Promise<string[]> {
    const referenced = await this.artifactService.findReferencedKeys();
    const objects = await this.strategy.list("functions/");
    return objects
      .filter(
        object =>
          isArtifactKey(object.key) &&
          !referenced.has(object.key) &&
          object.lastModified.getTime() < modifiedBefore
      )
      .map(object => object.key);
  }

  private stampOf(functionId: ObjectId, archiveKey: string | null) {
    return {
      functionId: functionId.toHexString(),
      filename: STAMP_FILENAME,
      hash: archiveKey ?? UNAVAILABLE_STAMP
    };
  }
}
