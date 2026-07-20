import {BuildMeta} from "@spica-server/interface-function-builder";
import {RollupBuilder} from "@spica-server/function-builder-rollup";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import fs from "fs";
import path from "path";

describe("RollupBuilder", () => {
  const workerPath = process.env.FUNCTION_ROLLUP_WORKER_PATH;

  function readBundle(meta: BuildMeta) {
    return fs.promises
      .readFile(path.join(meta.cwd, meta.outDir, meta.entrypoints.runtime))
      .then(buffer => buffer.toString());
  }

  function writeFile(meta: BuildMeta, name: string, content: string) {
    return fs.promises.writeFile(path.join(meta.cwd, name), content);
  }

  // Fakes an installed package so the bundler has something real to inline.
  function installPackage(meta: BuildMeta, name: string, files: {[filename: string]: string}) {
    const root = path.join(meta.cwd, "node_modules", ...name.split("/"));
    fs.mkdirSync(root, {recursive: true});
    for (const [filename, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(root, filename), content);
    }
  }

  describe("javascript", () => {
    let builder: RollupBuilder;

    const meta: BuildMeta = {
      cwd: undefined,
      entrypoints: {build: "index.mjs", runtime: "index.mjs"},
      outDir: ".build"
    };

    beforeEach(() => {
      builder = new RollupBuilder("javascript", {workerPath});
      meta.cwd = FunctionTestBed.initialize(``, meta);
      return fs.promises.mkdir(path.join(meta.cwd, "node_modules"), {recursive: true});
    });

    afterEach(() => builder.kill());

    it("should write nothing but the build output", async () => {
      await builder.build(meta);
      expect(fs.readdirSync(path.join(meta.cwd, meta.outDir)).sort()).toEqual([
        "index.mjs",
        "index.mjs.map"
      ]);
    });

    it("should bundle local imports into a single file", async () => {
      await writeFile(meta, "index.mjs", `export {handler} from "./handler.mjs";`);
      await writeFile(meta, "handler.mjs", `export function handler() { return "bundled"; }`);

      await builder.build(meta);

      const bundle = await readBundle(meta);
      expect(bundle).toContain("bundled");
      expect(bundle).toContain("export { handler }");
      expect(bundle).not.toContain("./handler.mjs");
    });

    it("should inline dependencies", async () => {
      installPackage(meta, "some-package", {
        "package.json": `{"name": "some-package", "version": "1.0.0", "main": "index.js", "type": "module"}`,
        "index.js": `export const greet = () => "hello from dependency";`
      });
      await writeFile(
        meta,
        "index.mjs",
        `import {greet} from "some-package";
         export default function() { return greet(); }`
      );

      await builder.build(meta);

      const bundle = await readBundle(meta);
      expect(bundle).toContain("hello from dependency");
      expect(bundle).not.toContain(`from "some-package"`);
    });

    it("should inline the esm build of a dual package that lists require first", async () => {
      installPackage(meta, "dual-package", {
        "package.json": `{
          "name": "dual-package",
          "version": "1.0.0",
          "exports": {".": {"require": "./cjs.js", "import": "./esm.mjs"}}
        }`,
        "cjs.js": `exports.greet = () => "from the commonjs build";`,
        "esm.mjs": `export const greet = () => "from the esm build";`
      });
      await writeFile(
        meta,
        "index.mjs",
        `import {greet} from "dual-package";
         export default function() { return greet(); }`
      );

      await builder.build(meta);

      expect(await readBundle(meta)).toContain("from the esm build");
    });

    it("should keep never bundled packages external", async () => {
      await writeFile(
        meta,
        "index.mjs",
        `import * as database from "@spica-devkit/database";
         export default function() { return database; }`
      );

      await builder.build(meta);

      const bundle = await readBundle(meta);
      expect(bundle).toContain(`from '@spica-devkit/database'`);
    });
  });

  describe("typescript", () => {
    let builder: RollupBuilder;

    const meta: BuildMeta = {
      cwd: undefined,
      entrypoints: {build: "index.ts", runtime: "index.mjs"},
      outDir: ".build"
    };

    beforeEach(() => {
      builder = new RollupBuilder("typescript", {workerPath});
      meta.cwd = FunctionTestBed.initialize(``, meta);
      return fs.promises.mkdir(path.join(meta.cwd, "node_modules"), {recursive: true});
    });

    afterEach(() => builder.kill());

    it("should bundle typescript sources", async () => {
      await writeFile(
        meta,
        "index.ts",
        `import {greet} from "./greeter.js";
         export default function(): string { return greet("spica"); }`
      );
      await writeFile(
        meta,
        "greeter.ts",
        `export function greet(name: string): string { return "hello " + name; }`
      );

      await builder.build(meta);

      const bundle = await readBundle(meta);
      expect(bundle).toContain("hello ");
      expect(bundle).toContain("export { ");
      expect(bundle).not.toContain(": string");
    });

    it("should write tsconfig.json", async () => {
      await writeFile(meta, "index.ts", `export default function() {}`);
      await builder.build(meta);

      const tsconfig = JSON.parse(
        (await fs.promises.readFile(path.join(meta.cwd, "tsconfig.json"))).toString()
      );
      expect(tsconfig.include).toEqual(["index.ts"]);
    });

    it("should report syntax errors", async () => {
      await writeFile(meta, "index.ts", `const a;`);

      const diagnostics = await builder.build(meta).catch(e => e);

      expect(Array.isArray(diagnostics)).toBe(true);
      expect(diagnostics[diagnostics.length - 1]).toEqual(
        expect.objectContaining({
          category: 1,
          text: expect.stringContaining("'const' declarations must be initialized"),
          start: expect.objectContaining({line: expect.any(Number)})
        })
      );
    });

    it("should report type errors", async () => {
      await writeFile(meta, "index.ts", `import {} from "non-existent-module";`);

      const diagnostics = await builder.build(meta).catch(e => e);

      expect(Array.isArray(diagnostics)).toBe(true);
      expect(diagnostics[diagnostics.length - 1]).toEqual(
        expect.objectContaining({
          code: "TS2307",
          category: 1,
          text: expect.stringContaining("Cannot find module 'non-existent-module'")
        })
      );
    });

    it("should build multiple functions in parallel", async () => {
      const first: BuildMeta = {
        cwd: FunctionTestBed.initialize(`export default function() { return "first"; }`, meta),
        entrypoints: meta.entrypoints,
        outDir: meta.outDir
      };
      const second: BuildMeta = {
        cwd: FunctionTestBed.initialize(`export default function() { return "second"; }`, meta),
        entrypoints: meta.entrypoints,
        outDir: meta.outDir
      };

      await Promise.all([builder.build(first), builder.build(second)]);

      expect(await readBundle(first)).toContain("first");
      expect(await readBundle(second)).toContain("second");
    });
  });
});
