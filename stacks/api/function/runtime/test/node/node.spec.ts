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

    fit("should compile entrypoint", async () => {
      compilation.cwd = FunctionTestBed.initialize(`export default function() {}`);
      await node.compile(compilation);
      const stat = await fs.promises.readFile(path.join(compilation.cwd, ".build", "index.js"));
      const files = fs.readdirSync(path.join(compilation.cwd));
      expect(files).toEqual("")
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
        path.join(compilation.cwd, ".build", "node_modules", "@internal", "database")
      );
      expect(stat.isSymbolicLink()).toBe(true);
    });

    it("should report diagnostics", async () => {
      compilation.cwd = FunctionTestBed.initialize(`
import {database} from '@spica-server/database';
export default function() {
  const a;
}
`);
      await expectAsync(node.compile(compilation)).toBeRejectedWith([
        {
          code: 2307,
          category: 1,
          text: "Cannot find module '@spica-server/database'.",
          start: {line: 2, column: 24},
          end: {line: 2, column: 48}
        },
        {
          code: 1155,
          category: 1,
          text: "'const' declarations must be initialized.",
          start: {line: 4, column: 9},
          end: {line: 4, column: 10}
        }
      ]);
    });
  });
});
