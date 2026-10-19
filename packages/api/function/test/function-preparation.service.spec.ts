import fs from "fs";
import os from "os";
import path from "path";
import {FunctionPreparationService} from "@spica-server/function/src/function-preparation.service";

describe("FunctionPreparationService", () => {
  describe("renameFunctionDirectory", () => {
    let root: string;
    let service: FunctionPreparationService;

    const write = (name: string, file: string, content: string) => {
      const filePath = path.join(root, name, file);
      fs.mkdirSync(path.dirname(filePath), {recursive: true});
      fs.writeFileSync(filePath, content);
    };

    beforeEach(() => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), "spica-fn-root-"));
      service = new FunctionPreparationService({} as any, {root, timeout: 1, outDir: ".build"});
    });

    afterEach(() => fs.rmSync(root, {recursive: true, force: true}));

    it("should move the directory with everything in it", async () => {
      write("old", "index.mjs", "code");
      write("old", "node_modules/dep/index.js", "dep");

      await service.renameFunctionDirectory("old", "new");

      expect(fs.existsSync(path.join(root, "old"))).toBe(false);
      expect(fs.readFileSync(path.join(root, "new", "index.mjs"), "utf-8")).toBe("code");
      expect(fs.readFileSync(path.join(root, "new", "node_modules/dep/index.js"), "utf-8")).toBe(
        "dep"
      );
    });

    it("should replace a leftover directory at the new name", async () => {
      write("old", "index.mjs", "current");
      write("new", "index.mjs", "stale");
      write("new", "stale.txt", "stale");

      await service.renameFunctionDirectory("old", "new");

      expect(fs.readFileSync(path.join(root, "new", "index.mjs"), "utf-8")).toBe("current");
      expect(fs.existsSync(path.join(root, "new", "stale.txt"))).toBe(false);
    });

    it("should leave the new name untouched when the previous directory does not exist", async () => {
      write("new", "index.mjs", "downloaded");

      await service.renameFunctionDirectory("old", "new");

      expect(fs.readFileSync(path.join(root, "new", "index.mjs"), "utf-8")).toBe("downloaded");
    });
  });
});
