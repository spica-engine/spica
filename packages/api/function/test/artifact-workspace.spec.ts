import fs from "fs";
import os from "os";
import path from "path";
import {ArtifactWorkspace} from "@spica-server/function/src/artifact/artifact-workspace";

describe("ArtifactWorkspace", () => {
  const fn = {name: "my-function"} as any;
  let tmp: string;
  let root: string;
  let scratch: string;
  let workspace: ArtifactWorkspace;

  beforeEach(async () => {
    tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "artifact-workspace-"));
    root = path.join(tmp, "functions");
    scratch = path.join(tmp, ".function-artifacts", os.hostname());
    workspace = new ArtifactWorkspace({root, outDir: ".build", timeout: 1});
    await fs.promises.mkdir(workspace.functionDir(fn), {recursive: true});
  });

  afterEach(() => fs.promises.rm(tmp, {recursive: true, force: true}));

  describe("marker", () => {
    it("should match only the key the tree was marked with", async () => {
      expect(await workspace.matches(fn, "a")).toBe(false);

      await workspace.markBuilt(workspace.functionDir(fn), "a");

      expect(await workspace.matches(fn, "a")).toBe(true);
      expect(await workspace.matches(fn, "b")).toBe(false);
    });
  });

  describe("scratch", () => {
    it("should clear leftovers of a previous process before first use", async () => {
      const leftover = path.join(scratch, "staging", "old");
      await fs.promises.mkdir(leftover, {recursive: true});

      await workspace.newTempFile(fn);

      expect(fs.existsSync(leftover)).toBe(false);
    });

    it("should not clear files it created itself", async () => {
      const staging = await workspace.newStagingDir(fn);

      await workspace.newTempFile(fn);

      expect(fs.existsSync(staging)).toBe(true);
    });

    it("should hand out unique paths", async () => {
      const [a, b] = await Promise.all([workspace.newTempFile(fn), workspace.newTempFile(fn)]);
      expect(a).not.toEqual(b);
    });

    it("should prune entries older than their time to live", async () => {
      const staging = await workspace.newStagingDir(fn);
      const now = Date.now();

      await workspace.prune(now);
      expect(fs.existsSync(staging)).toBe(true);

      await workspace.prune(now + 2 * 60 * 60 * 1000);
      expect(fs.existsSync(staging)).toBe(false);
    });
  });

  describe("swapIn", () => {
    it("should replace the function directory and move the old one to trash", async () => {
      await fs.promises.writeFile(path.join(workspace.functionDir(fn), "old.txt"), "old");
      const staging = await workspace.newStagingDir(fn);
      await fs.promises.writeFile(path.join(staging, "new.txt"), "new");

      await workspace.swapIn(fn, staging);

      expect(await fs.promises.readdir(workspace.functionDir(fn))).toEqual(["new.txt"]);
      const [trashed] = await fs.promises.readdir(path.join(scratch, "trash"));
      expect(await fs.promises.readdir(path.join(scratch, "trash", trashed))).toEqual(["old.txt"]);
      expect(fs.existsSync(staging)).toBe(false);
    });

    it("should create the function directory when it does not exist yet", async () => {
      await fs.promises.rm(root, {recursive: true});
      const staging = await workspace.newStagingDir(fn);

      await workspace.swapIn(fn, staging);

      expect(fs.existsSync(workspace.functionDir(fn))).toBe(true);
    });

    it("should date trash entries by the swap, not by their last change", async () => {
      const staging = await workspace.newStagingDir(fn);
      const old = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await fs.promises.utimes(workspace.functionDir(fn), old, old);

      await workspace.swapIn(fn, staging);
      await workspace.prune(Date.now());

      expect(await fs.promises.readdir(path.join(scratch, "trash"))).toHaveLength(1);
    });
  });

  describe("copySourcesInto", () => {
    it("should copy source files missing from the staging directory only", async () => {
      await fs.promises.writeFile(path.join(workspace.functionDir(fn), "index.ts"), "source");
      await fs.promises.writeFile(path.join(workspace.functionDir(fn), "package.json"), "old");
      const staging = await workspace.newStagingDir(fn);
      await fs.promises.writeFile(path.join(staging, "package.json"), "archived");

      await workspace.copySourcesInto(fn, staging);

      expect(await fs.promises.readFile(path.join(staging, "index.ts"), "utf-8")).toBe("source");
      expect(await fs.promises.readFile(path.join(staging, "package.json"), "utf-8")).toBe(
        "archived"
      );
    });
  });
});
