import {ObjectId} from "@spica-server/database";
import {AssetRecorder} from "@spica-server/function/src/asset-recorder";
import {SelfWriteTracker} from "@spica-server/function/src/asset-write-tracker";
import {hashBuffer} from "@spica-server/function/src/asset-keys";

describe("AssetRecorder", () => {
  const fn = {_id: new ObjectId(), name: "my-function"} as any;
  const data = Buffer.from("lock");

  let strategy: {write: jest.Mock};
  let assetService: {findByFilename: jest.Mock; upsertAsset: jest.Mock};
  let tracker: SelfWriteTracker;
  let recorder: AssetRecorder;

  beforeEach(() => {
    strategy = {write: jest.fn().mockResolvedValue(undefined)};
    assetService = {
      findByFilename: jest.fn().mockResolvedValue(null),
      upsertAsset: jest.fn().mockResolvedValue(undefined)
    };
    tracker = new SelfWriteTracker();
    recorder = new AssetRecorder(
      strategy as any,
      {strategy: "awss3"},
      assetService as any,
      tracker
    );
  });

  it("should write the object and describe it without recording it", async () => {
    const uploaded = await recorder.upload(fn.name, "package-lock.json", data);

    expect(strategy.write).toHaveBeenCalledWith("functions/my-function/package-lock.json", data);
    expect(uploaded).toEqual({
      filename: "package-lock.json",
      key: "functions/my-function/package-lock.json",
      hash: hashBuffer(data),
      size: data.byteLength,
      uploadDate: expect.any(Date),
      strategy: "awss3"
    });
    expect(assetService.upsertAsset).not.toHaveBeenCalled();
  });

  it("should record an uploaded asset as a self-write", async () => {
    const uploaded = await recorder.upload(fn.name, "package-lock.json", data);

    await recorder.record(fn._id, uploaded);

    const {filename, ...fields} = uploaded;
    expect(assetService.upsertAsset).toHaveBeenCalledWith(fn._id, filename, fields);
    expect(
      tracker.isSelfWrite({
        functionId: fn._id.toHexString(),
        filename,
        hash: uploaded.hash
      })
    ).toBe(true);
  });

  it("should store a file whose record differs", async () => {
    assetService.findByFilename.mockResolvedValue({hash: "old"});

    await recorder.storeIfChanged(fn, "package-lock.json", data);

    expect(strategy.write).toHaveBeenCalledTimes(1);
    expect(assetService.upsertAsset).toHaveBeenCalledTimes(1);
  });

  it("should skip a file whose record already matches", async () => {
    assetService.findByFilename.mockResolvedValue({hash: hashBuffer(data)});

    await recorder.storeIfChanged(fn, "package-lock.json", data);

    expect(strategy.write).not.toHaveBeenCalled();
    expect(assetService.upsertAsset).not.toHaveBeenCalled();
  });
});
