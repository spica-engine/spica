import {Compilation} from "@spica-server/function/runtime";
import {Node} from "@spica-server/function/runtime/node";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import * as fs from "fs";
import * as path from "path";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

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

      const files = fs.readdirSync(path.join(compilation.cwd, ".build"));
      expect(files).toContain(".tsbuildinfo");

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
        path.join(compilation.cwd, ".build", "node_modules", "@internal", "database")
      );
      expect(stat.isSymbolicLink()).toBe(true);
    });

    xit("should report diagnostics", async () => {
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

    xit("should report diagnostics for multiple functions", async () => {
      const first: Compilation = {
        cwd: FunctionTestBed.initialize(`const a;`),
        entrypoint: "index.ts"
      };
      const second: Compilation = {
        cwd: FunctionTestBed.initialize(`import {} from 'non-existent-module';`),
        entrypoint: "index.ts"
      };
      const diagnostics = await Promise.all([
        node.compile(first).catch(e => e),
        node.compile(second).catch(e => e)
      ]);

      expect(diagnostics).toEqual([
        [
          {
            code: 1155,
            category: 1,
            text: "'const' declarations must be initialized.",
            start: {line: 1, column: 7},
            end: {line: 1, column: 8}
          }
        ],
        [
          {
            code: 2307,
            category: 1,
            text: "Cannot find module 'non-existent-module'.",
            start: {line: 1, column: 16},
            end: {line: 1, column: 37}
          }
        ]
      ]);
    });

    xit("should report diagnostics incrementally", async () => {
      compilation.cwd = FunctionTestBed.initialize(`export default function() {}`);
      const indexPath = path.join(compilation.cwd, "index.ts");
      expect(await node.compile(compilation)).not.toBeTruthy();

      setTimeout(() => {
        fs.promises.writeFile(indexPath, `const a;`);
      }, 1);
      expect(await node.compile(compilation).catch(e => e)).toEqual([
        {
          code: 1155,
          category: 1,
          text: "'const' declarations must be initialized.",
          start: {line: 1, column: 7},
          end: {line: 1, column: 8}
        }
      ]);
    }, 20000);

    it("should kill the process", () => {
      const worker = node.spawn({id: "test", env: {}});
      expect(worker["_process"].killed).toEqual(false);
      worker.kill();
      expect(worker["_process"].killed).toEqual(true);
    });
  });
});
