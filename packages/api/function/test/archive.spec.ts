import fs from "fs";
import os from "os";
import path from "path";
import * as tar from "tar";
import {packDirectory, unpackArchive} from "@spica-server/function/src/artifact/archive";

describe("archive", () => {
  let tmp: string;
  let source: string;
  let target: string;
  let file: string;

  beforeEach(async () => {
    tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "archive-"));
    source = path.join(tmp, "source");
    target = path.join(tmp, "target");
    file = path.join(tmp, "archive.tar.gz");
    await fs.promises.mkdir(source);
    await fs.promises.mkdir(target);
  });

  afterEach(() => fs.promises.rm(tmp, {recursive: true, force: true}));

  describe("round trip", () => {
    beforeEach(async () => {
      await fs.promises.mkdir(path.join(source, ".build"));
      await fs.promises.writeFile(path.join(source, ".build", "index.mjs"), "built");
      await fs.promises.mkdir(path.join(source, "node_modules", "@spica-fn"), {recursive: true});
      await fs.promises.symlink(
        "../../../sibling",
        path.join(source, "node_modules", "@spica-fn", "sibling")
      );
      await fs.promises.symlink(
        "/data/functions/fn/node_modules",
        path.join(source, ".build", "node_modules")
      );
      await fs.promises.writeFile(path.join(source, "package.json"), "{}");
      await fs.promises.writeFile(path.join(source, "index.ts"), "source");
    });

    it("should pack only the listed entries that exist", async () => {
      await packDirectory(source, [".build", "package.json", "package-lock.json"], file);
      await unpackArchive(file, target);

      expect((await fs.promises.readdir(target)).sort()).toEqual([".build", "package.json"]);
    });

    it("should keep symlinks that point outside the directory", async () => {
      await packDirectory(source, [".build", "node_modules"], file);
      await unpackArchive(file, target);

      expect(
        await fs.promises.readlink(path.join(target, "node_modules", "@spica-fn", "sibling"))
      ).toBe("../../../sibling");
      expect(await fs.promises.readlink(path.join(target, ".build", "node_modules"))).toBe(
        "/data/functions/fn/node_modules"
      );
      expect(await fs.promises.readFile(path.join(target, ".build", "index.mjs"), "utf-8")).toBe(
        "built"
      );
    });
  });

  describe("untrusted archives", () => {
    let outside: string;

    beforeEach(async () => {
      outside = path.join(tmp, "outside");
      await fs.promises.mkdir(outside);
    });

    it("should not write files through a symlink from the same archive", async () => {
      const linkSource = path.join(tmp, "link-source");
      const fileSource = path.join(tmp, "file-source");
      await fs.promises.mkdir(linkSource);
      await fs.promises.symlink(outside, path.join(linkSource, "evil"));
      await fs.promises.mkdir(path.join(fileSource, "evil"), {recursive: true});
      await fs.promises.writeFile(path.join(fileSource, "evil", "pwn.txt"), "pwn");
      const crafted = path.join(tmp, "crafted.tar");
      await tar.c({cwd: linkSource, file: crafted}, ["evil"]);
      await tar.r({cwd: fileSource, file: crafted}, ["evil/pwn.txt"]);

      await unpackArchive(crafted, target);

      expect(fs.existsSync(path.join(outside, "pwn.txt"))).toBe(false);
    });

    it("should not write entries with parent-relative paths", async () => {
      const nested = path.join(tmp, "nested", "source");
      await fs.promises.mkdir(nested, {recursive: true});
      await fs.promises.writeFile(path.join(tmp, "nested", "escape.txt"), "pwn");
      const crafted = path.join(tmp, "crafted.tar");
      await tar.c({cwd: nested, file: crafted, preservePaths: true}, ["../escape.txt"]);
      await fs.promises.rm(path.join(tmp, "nested", "escape.txt"));

      await unpackArchive(crafted, target);

      expect(fs.existsSync(path.join(tmp, "escape.txt"))).toBe(false);
      expect(fs.existsSync(path.join(tmp, "nested", "escape.txt"))).toBe(false);
    });
  });
});
