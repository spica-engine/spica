import {Inject, Injectable} from "@nestjs/common";
import {ObjectId} from "@spica-server/database";
import {FunctionAssetService} from "@spica-server/function-services";
import {Function} from "@spica-server/interface-function";
import {
  FunctionAsset,
  FunctionAssetFilename,
  FunctionAssetStorageOptions,
  FunctionAssetStrategy,
  FUNCTION_ASSET_STORAGE_OPTIONS,
  FUNCTION_ASSET_STRATEGY
} from "@spica-server/interface-function-asset-storage";
import {assetKey, hashBuffer} from "./asset-keys.js";
import {SelfWriteTracker} from "./asset-write-tracker.js";

export type UploadedAsset = Omit<FunctionAsset, "functionId" | "_id">;

@Injectable()
export class AssetRecorder {
  constructor(
    @Inject(FUNCTION_ASSET_STRATEGY) private readonly strategy: FunctionAssetStrategy,
    @Inject(FUNCTION_ASSET_STORAGE_OPTIONS)
    private readonly storageOptions: FunctionAssetStorageOptions,
    private readonly assetService: FunctionAssetService,
    private readonly tracker: SelfWriteTracker
  ) {}

  async upload(
    functionName: string,
    filename: FunctionAssetFilename,
    data: Buffer
  ): Promise<UploadedAsset> {
    const key = assetKey(functionName, filename);
    await this.strategy.write(key, data);
    return {
      filename,
      key,
      hash: hashBuffer(data),
      size: data.byteLength,
      uploadDate: new Date(),
      strategy: this.storageOptions.strategy
    };
  }

  async record(functionId: ObjectId, {filename, ...fields}: UploadedAsset): Promise<void> {
    this.tracker.stamp({functionId: functionId.toHexString(), filename, hash: fields.hash});
    await this.assetService.upsertAsset(functionId, filename, fields);
  }

  async storeIfChanged(
    fn: Function & {_id: ObjectId},
    filename: FunctionAssetFilename,
    data: Buffer
  ): Promise<void> {
    const current = await this.assetService.findByFilename(fn._id, filename);
    if (current?.hash === hashBuffer(data)) return;
    await this.record(fn._id, await this.upload(fn.name, filename, data));
  }
}
