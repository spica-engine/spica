import {Compilation} from "@spica-server/function/runtime";
import {Node} from "@spica-server/function/runtime/node";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import * as fs from "fs";
import * as path from "path";

describe("Node", () => {
  let node: Node;

  const compilation: Compilation = {
    cwd: undefined,
    entrypoint: "index.ts"
  };

  beforeEach(async () => {
    node = new Node();
  });

  describe("compilation", () => {
    beforeEach(() => {
      compilation.cwd = FunctionTestBed.initialize(``);
      return fs.promises.mkdir(path.join(compilation.cwd, "node_modules"), {recursive: true});
    });

    it("should symlink node_modules to .build path", async () => {
      await node.compile(compilation);
      const stat = await fs.promises.lstat(path.join(compilation.cwd, ".build", "node_modules"));
      expect(stat.isSymbolicLink()).toBe(true);
    });

    it("should compile entrypoint", async () => {
      compilation.cwd = FunctionTestBed.initialize(`export default function() {}`);
      await node.compile(compilation);
      const stat = await fs.promises.readFile(path.join(compilation.cwd, ".build", "index.js"));
      expect(stat.toString()).toContain("exports.default = default_1");
    });

    it("should symlink @spica-devkit/database to @internal/database", async () => {
      compilation.cwd = FunctionTestBed.initialize(`export default function() {}`);
      const devkitDatabasePath = path.join(
        compilation.cwd,
        "node_modules",
        "@spica-devkit",
        "database"
      );
      await fs.promises.mkdir(devkitDatabasePath, {recursive: true});
      await fs.promises.writeFile(
        path.join(devkitDatabasePath, "package.json"),
        JSON.stringify({name: "@spica-devkit/database"})
      );

      await node.compile(compilation);
      const stat = await fs.promises.lstat(
        path.join(compilation.cwd, ".build", "node_modules", "@internal")
      );
      expect(stat.isSymbolicLink()).toBe(true);
    });
  });
});
