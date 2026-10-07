import fs from "fs";
import os from "os";
import path from "path";
import {ObjectId} from "@spica-server/database";
import {DefaultStrategy} from "@spica-server/function-asset-storage";
import {FunctionArtifactSync} from "@spica-server/function/src/artifact/artifact-sync";
import {ArtifactIdentity} from "@spica-server/function/src/artifact/artifact-identity";
import {ArtifactStore} from "@spica-server/function/src/artifact/artifact-store";
import {ArtifactWorkspace} from "@spica-server/function/src/artifact/artifact-workspace";
import {isArtifactKey} from "@spica-server/function/src/artifact/artifact-key";
import {SelfWriteTracker} from "@spica-server/function/src/asset-write-tracker";
import {AssetRecorder} from "@spica-server/function/src/asset-recorder";
import {KeyedMutex} from "@spica-server/function/src/keyed-mutex";
import {hashBuffer} from "@spica-server/function/src/asset-keys";

const fn = {_id: new ObjectId(), name: "my-function", language: "typescript"} as any;

let tmp: string;
let root: string;
let fnDir: string;
let strategy: DefaultStrategy;
let artifactRecords: Map<string, any>;
let assetRecords: Map<string, any>;
let artifactService: Record<string, jest.Mock>;
let assetService: Record<string, jest.Mock>;
let preparationService: Record<string, jest.Mock>;
let tracker: SelfWriteTracker;
let mutex: KeyedMutex;
let sync: FunctionArtifactSync;

function buildSync() {
  const options = {root, outDir: ".build", timeout: 1, builder: "legacy"};
  return new FunctionArtifactSync(
    new ArtifactIdentity(preparationService as any, options),
    new ArtifactWorkspace(options),
    new ArtifactStore(strategy, artifactService as any, tracker),
    preparationService as any,
    new AssetRecorder(strategy, {strategy: "default"}, assetService as any, tracker),
    mutex
  );
}

function restoreOrBuild(allowFallback: boolean) {
  return mutex.run(fn.name, () => sync.restoreOrBuild(fn, {allowFallback}));
}

async function writeSources(index = "export default () => 1;", deps = {}) {
  await fs.promises.mkdir(fnDir, {recursive: true});
  await fs.promises.writeFile(path.join(fnDir, "index.ts"), index);
  await fs.promises.writeFile(
    path.join(fnDir, "package.json"),
    JSON.stringify({name: fn.name, dependencies: deps})
  );
}

async function installAndBuild() {
  await preparationService.installPackages(fn, []);
  await preparationService.build(fn);
}

async function wipeToSources() {
  const sources = {};
  for (const filename of ["index.ts", "package.json", "package-lock.json"]) {
    sources[filename] = await fs.promises.readFile(path.join(fnDir, filename));
  }
  await fs.promises.rm(fnDir, {recursive: true, force: true});
  await fs.promises.mkdir(fnDir, {recursive: true});
  for (const [filename, data] of Object.entries(sources)) {
    await fs.promises.writeFile(path.join(fnDir, filename), data as Buffer);
  }
}

beforeEach(async () => {
  tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "artifact-sync-"));
  root = path.join(tmp, "functions");
  fnDir = path.join(root, fn.name);
  strategy = new DefaultStrategy(path.join(tmp, "bucket"));
  tracker = new SelfWriteTracker();

  artifactRecords = new Map();
  artifactService = {
    upsertArtifact: jest.fn(async (functionId, platform, fields) => {
      artifactRecords.set(`${functionId}:${platform}`, {functionId, platform, ...fields});
    }),
    findReferencedKeys: jest.fn(
      async () => new Set([...artifactRecords.values()].map(r => r.key).filter(Boolean))
    ),
    deleteByFunction: jest.fn(async () => artifactRecords.clear())
  };

  assetRecords = new Map();
  assetService = {
    findByFilename: jest.fn(async (_id, filename) => assetRecords.get(filename) ?? null),
    upsertAsset: jest.fn(async (_id, filename, fields) => {
      assetRecords.set(filename, {filename, ...fields});
    })
  };

  preparationService = {
    indexFilename: jest.fn().mockReturnValue("index.ts"),
    readFileBuffer: jest.fn(async (target, filename) =>
      fs.promises.readFile(path.join(root, target.name, filename)).catch(() => null)
    ),
    installPackages: jest.fn(async target => {
      const dir = path.join(root, target.name);
      await fs.promises.mkdir(path.join(dir, "node_modules", "dep"), {recursive: true});
      await fs.promises.writeFile(path.join(dir, "node_modules", "dep", "index.js"), "dep");
      await fs.promises.mkdir(path.join(dir, "node_modules", "@spica-fn"), {recursive: true});
      await fs.promises
        .symlink("../../../sibling", path.join(dir, "node_modules", "@spica-fn", "sibling"))
        .catch(() => undefined);
      await fs.promises.writeFile(path.join(dir, "package-lock.json"), '{"lockfileVersion":3}');
    }),
    build: jest.fn(async target => {
      const dir = path.join(root, target.name);
      await fs.promises.mkdir(path.join(dir, ".build"), {recursive: true});
      const index = await fs.promises.readFile(path.join(dir, "index.ts"), "utf-8");
      await fs.promises.writeFile(path.join(dir, ".build", "index.mjs"), `// built\n${index}`);
      await fs.promises
        .symlink(path.join(dir, "node_modules"), path.join(dir, ".build", "node_modules"))
        .catch(() => undefined);
    })
  };

  mutex = new KeyedMutex();
  sync = buildSync();
  await writeSources();
  await installAndBuild();
});

afterEach(async () => {
  await fs.promises.rm(tmp, {recursive: true, force: true});
});

describe("FunctionArtifactSync.publish", () => {
  it("should upload an archive, record its key and write the marker", async () => {
    await sync.publish(fn);

    const [record] = artifactRecords.values();
    expect(isArtifactKey(record.key)).toBe(true);
    expect(await strategy.exists(record.key)).toBe(true);
    expect(record.inputs).toEqual({
      index: hashBuffer(await fs.promises.readFile(path.join(fnDir, "index.ts"))),
      packageJson: hashBuffer(await fs.promises.readFile(path.join(fnDir, "package.json"))),
      lockfile: hashBuffer(await fs.promises.readFile(path.join(fnDir, "package-lock.json"))),
      builder: "legacy"
    });
    expect(await fs.promises.readFile(path.join(fnDir, ".spica-artifact"), "utf-8")).toBe(
      record.key
    );
  });

  it("should track the lockfile as an asset before recording the artifact", async () => {
    await sync.publish(fn);

    const lockfile = assetRecords.get("package-lock.json");
    expect(lockfile.key).toBe(`functions/${fn.name}/package-lock.json`);
    expect(await strategy.read(lockfile.key)).toEqual(
      await fs.promises.readFile(path.join(fnDir, "package-lock.json"))
    );
  });

  it("should not upload again when the local tree already matches", async () => {
    await sync.publish(fn);
    const upload = jest.spyOn(strategy, "upload");

    await sync.publish(fn);

    expect(upload).not.toHaveBeenCalled();
  });

  it("should skip the upload when an identical archive is already stored", async () => {
    await sync.publish(fn);
    await fs.promises.rm(path.join(fnDir, ".spica-artifact"));
    const upload = jest.spyOn(strategy, "upload");

    await sync.publish(fn);

    expect(upload).not.toHaveBeenCalled();
    expect(artifactService.upsertArtifact).toHaveBeenCalledTimes(2);
  });

  it("should record an unavailable artifact and not throw when the upload fails", async () => {
    jest.spyOn(strategy, "upload").mockRejectedValueOnce(new Error("bucket down"));

    await expect(sync.publish(fn)).resolves.toBeUndefined();

    const [record] = artifactRecords.values();
    expect(record.key).toBeNull();
  });

  it("should record an unavailable artifact without uploading when the build failed", async () => {
    const upload = jest.spyOn(strategy, "upload");

    await sync.publish(fn, {buildFailed: true});

    expect(upload).not.toHaveBeenCalled();
    const [record] = artifactRecords.values();
    expect(record.key).toBeNull();
  });

  it("should stamp the artifact write so the local watcher ignores it", async () => {
    await sync.publish(fn);

    const [record] = artifactRecords.values();
    expect(
      tracker.isSelfWrite({
        functionId: fn._id.toHexString(),
        filename: "artifact",
        hash: record.key
      })
    ).toBe(true);
  });
});

describe("FunctionArtifactSync.restoreOrBuild", () => {
  it("should restore the build and node_modules from the archive without installing", async () => {
    await sync.publish(fn);
    const builtIndex = await fs.promises.readFile(path.join(fnDir, ".build", "index.mjs"));
    await wipeToSources();
    preparationService.installPackages.mockClear();
    preparationService.build.mockClear();

    const changed = await restoreOrBuild(false);

    expect(changed).toBe(true);
    expect(preparationService.installPackages).not.toHaveBeenCalled();
    expect(preparationService.build).not.toHaveBeenCalled();
    expect(await fs.promises.readFile(path.join(fnDir, ".build", "index.mjs"))).toEqual(builtIndex);
    expect(
      await fs.promises.readFile(path.join(fnDir, "node_modules", "dep", "index.js"), "utf-8")
    ).toBe("dep");
    expect(await fs.promises.readFile(path.join(fnDir, "index.ts"), "utf-8")).toBe(
      "export default () => 1;"
    );
  });

  it("should preserve relative and absolute symlinks", async () => {
    await sync.publish(fn);
    await wipeToSources();

    await restoreOrBuild(false);

    expect(
      await fs.promises.readlink(path.join(fnDir, "node_modules", "@spica-fn", "sibling"))
    ).toBe("../../../sibling");
    expect(await fs.promises.readlink(path.join(fnDir, ".build", "node_modules"))).toBe(
      path.join(fnDir, "node_modules")
    );
  });

  it("should be a no-op when the marker already matches", async () => {
    await sync.publish(fn);
    const download = jest.spyOn(strategy, "download");

    const changed = await restoreOrBuild(true);

    expect(changed).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });

  it("should keep the current tree intact until the extracted one is swapped in", async () => {
    await sync.publish(fn);
    await fs.promises.writeFile(path.join(fnDir, "index.ts"), "export default () => 2;");
    await preparationService.build(fn);
    await sync.publish(fn);
    await fs.promises.writeFile(path.join(fnDir, "index.ts"), "export default () => 1;");

    const download = strategy.download.bind(strategy);
    jest.spyOn(strategy, "download").mockImplementation(async (key, file) => {
      expect(
        await fs.promises.readFile(path.join(fnDir, ".build", "index.mjs"), "utf-8")
      ).toContain("() => 2");
      return download(key, file);
    });

    await restoreOrBuild(false);

    expect(await fs.promises.readFile(path.join(fnDir, ".build", "index.mjs"), "utf-8")).toContain(
      "() => 1"
    );
    const scratch = path.join(tmp, ".function-artifacts", os.hostname());
    expect(await fs.promises.readdir(path.join(scratch, "staging"))).toEqual([]);
    expect(await fs.promises.readdir(path.join(scratch, "trash"))).toHaveLength(1);
  });

  it("should install, build and publish when no archive exists and fallback is allowed", async () => {
    await wipeToSources();
    preparationService.installPackages.mockClear();
    preparationService.build.mockClear();

    const changed = await restoreOrBuild(true);

    expect(changed).toBe(true);
    expect(preparationService.installPackages).toHaveBeenCalledTimes(1);
    expect(preparationService.build).toHaveBeenCalledTimes(1);
    const [record] = artifactRecords.values();
    expect(await strategy.exists(record.key)).toBe(true);
  });

  it("should leave the tree alone when no archive exists and fallback is not allowed", async () => {
    await wipeToSources();
    preparationService.installPackages.mockClear();

    const changed = await restoreOrBuild(false);

    expect(changed).toBe(false);
    expect(preparationService.installPackages).not.toHaveBeenCalled();
  });

  it("should fall back to install and build when the archive cannot be restored", async () => {
    await sync.publish(fn);
    await wipeToSources();
    jest.spyOn(strategy, "download").mockRejectedValueOnce(new Error("corrupt"));
    preparationService.installPackages.mockClear();

    const changed = await restoreOrBuild(true);

    expect(changed).toBe(true);
    expect(preparationService.installPackages).toHaveBeenCalledTimes(1);
    expect(await fs.promises.readFile(path.join(fnDir, "index.ts"), "utf-8")).toBe(
      "export default () => 1;"
    );
  });
});

describe("FunctionArtifactSync.delete", () => {
  it("should delete the function's archives and records", async () => {
    await sync.publish(fn);
    const [record] = artifactRecords.values();

    await sync.delete(fn);

    expect(await strategy.exists(record.key)).toBe(false);
    expect(artifactService.deleteByFunction).toHaveBeenCalledWith(fn._id);
  });
});
