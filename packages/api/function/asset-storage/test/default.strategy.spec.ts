import * as os from "os";
import * as path from "path";
import * as fsSync from "fs";
import {DefaultStrategy} from "../src/strategy/default.js";

describe("DefaultStrategy", () => {
  let tmpDir: string;
  let strategy: DefaultStrategy;

  beforeEach(() => {
    tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "default-strategy-test-"));
    strategy = new DefaultStrategy(tmpDir);
  });

  afterEach(async () => {
    await fsSync.promises.rm(tmpDir, {recursive: true, force: true});
  });

  it("should write and read a file", async () => {
    const data = Buffer.from("hello world");
    await strategy.write("functions/abc/index.ts", data);
    const result = await strategy.read("functions/abc/index.ts");
    expect(result).toEqual(data);
  });

  it("should create parent directories on write", async () => {
    await strategy.write("a/b/c/file.txt", Buffer.from("deep"));
    const exists = await strategy.exists("a/b/c/file.txt");
    expect(exists).toBe(true);
  });

  it("should return false for a non-existent key", async () => {
    expect(await strategy.exists("no/such/file.txt")).toBe(false);
  });

  it("should return true for an existing key", async () => {
    await strategy.write("key.txt", Buffer.from("x"));
    expect(await strategy.exists("key.txt")).toBe(true);
  });

  it("should delete an existing file", async () => {
    await strategy.write("del.txt", Buffer.from("bye"));
    await strategy.delete("del.txt");
    expect(await strategy.exists("del.txt")).toBe(false);
  });

  it("should not throw when deleting a non-existent key", async () => {
    await expect(strategy.delete("ghost.txt")).resolves.not.toThrow();
  });

  it("should overwrite existing content on write", async () => {
    await strategy.write("file.txt", Buffer.from("v1"));
    await strategy.write("file.txt", Buffer.from("v2"));
    const result = await strategy.read("file.txt");
    expect(result.toString()).toBe("v2");
  });

  it("should upload a file and download it back", async () => {
    const source = path.join(tmpDir, "source.bin");
    const target = path.join(tmpDir, "out", "target.bin");
    await fsSync.promises.writeFile(source, "archive");

    await strategy.upload("functions/fn/artifacts/a.tar.gz", source);
    await strategy.download("functions/fn/artifacts/a.tar.gz", target);

    expect((await fsSync.promises.readFile(target)).toString()).toBe("archive");
  });

  it("should list only keys under the prefix", async () => {
    await strategy.write("functions/fn/artifacts/a.tar.gz", Buffer.from("a"));
    await strategy.write("functions/fn/index.ts", Buffer.from("b"));
    await strategy.write("functions/other/artifacts/c.tar.gz", Buffer.from("c"));

    const objects = await strategy.list("functions/fn/artifacts/");

    expect(objects.map(o => o.key)).toEqual(["functions/fn/artifacts/a.tar.gz"]);
    expect(objects[0].lastModified.getTime()).toEqual(expect.any(Number));
  });

  it("should return an empty list when nothing was stored", async () => {
    const empty = new DefaultStrategy(path.join(tmpDir, "missing"));
    expect(await empty.list("functions/")).toEqual([]);
  });
});
