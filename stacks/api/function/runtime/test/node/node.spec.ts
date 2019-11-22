import {Compilation} from "@spica-server/function/runtime";
import {Node} from "@spica-server/function/runtime/node";
import * as fs from "fs";
import * as path from "path";

describe("Node", () => {
  let node: Node;
  const compilation: Compilation = {
    cwd: "/tmp/fn2",
    id: "",
    entrypoint: "index.ts"
  };

  beforeEach(async () => {
    node = new Node();
  });

  describe("compilation", () => {
    beforeEach(async () => {
      await node.clear(compilation);
      return fs.promises.mkdir(path.join(compilation.cwd, "node_modules"), {recursive: true});
    });

    it("should symlink node_modules to .build path", async () => {
      await fs.promises.writeFile(path.join(compilation.cwd, compilation.entrypoint), "");
      await node.compile(compilation);
      const stat = await fs.promises.lstat(path.join(compilation.cwd, ".build", "node_modules"));
      expect(stat.isSymbolicLink()).toBe(true);
    });

    it("should compile entrypoint", async () => {
      await fs.promises.writeFile(
        path.join(compilation.cwd, compilation.entrypoint),
        `export default function() {}`
      );
      await node.compile(compilation);
      const stat = await fs.promises.readFile(path.join(compilation.cwd, ".build", "index.js"));
      expect(stat.toString()).toContain("exports.default = default_1");
    });
  });

  describe("execution", () => {
    async function initFunction(index: string) {
      await fs.promises.mkdir(compilation.cwd, {recursive: true});
      await fs.promises.writeFile(path.join(compilation.cwd, "index.ts"), index);
      await node.clear(compilation);
      return node.compile(compilation);
    }

    it("should spin up new process", async () => {
      await initFunction(`
      export default function() {
  
      }
      `);
      const result = await node.execute({
        cwd: compilation.cwd,
        entrypoint: "index.js",
        handler: "default"
      });

      expect(result).toBe(0);
    });
  });
});
