import {BuildMeta} from "@spica-server/interface-function-builder";
import {RollupBuilder, RollupWorkerHost} from "@spica-server/function-builder-rollup";
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

    // A native addon references its `.node` binary from its own code, which rollup cannot
    // resolve; inlining it aborts the build. Detecting the addon and leaving it external
    // keeps the build alive, exactly as it would resolve at runtime.
    it("should externalize a package that ships a native addon", async () => {
      installPackage(meta, "gyp-package", {
        "package.json": `{"name": "gyp-package", "version": "1.0.0", "main": "index.js"}`,
        "binding.gyp": `{"targets": [{"target_name": "addon"}]}`,
        "index.js": `module.exports = require("./build/Release/addon.node");`
      });
      installPackage(meta, "prebuilt-package", {
        "package.json": `{"name": "prebuilt-package", "version": "1.0.0", "main": "index.js"}`,
        "addon.node": "",
        "index.js": `module.exports = require("./addon.node");`
      });
      await writeFile(
        meta,
        "index.mjs",
        `import gyp from "gyp-package";
         import prebuilt from "prebuilt-package";
         export default function() { return [gyp, prebuilt]; }`
      );

      await builder.build(meta);

      const bundle = await readBundle(meta);
      expect(bundle).toContain(`from 'gyp-package'`);
      expect(bundle).toContain(`from 'prebuilt-package'`);
    });

    it("should still inline a normal dependency that has no native addon", async () => {
      installPackage(meta, "pure-package", {
        "package.json": `{"name": "pure-package", "version": "1.0.0", "main": "index.js", "type": "module"}`,
        "index.js": `export const value = "pure inlined value";`
      });
      await writeFile(
        meta,
        "index.mjs",
        `import {value} from "pure-package";
         export default function() { return value; }`
      );

      await builder.build(meta);

      const bundle = await readBundle(meta);
      expect(bundle).toContain("pure inlined value");
      expect(bundle).not.toContain(`from 'pure-package'`);
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

  // Regression: a worker that dies (e.g. a heavy bundle exhausting its heap ->
  // ERR_WORKER_OUT_OF_MEMORY) emits an 'error' event. Without a listener node rethrows it and
  // the whole api process crashes. A crashing worker here must fail the build instead — if the
  // handler regressed, the unhandled 'error' would take down this test process.
  describe("worker crash", () => {
    let crashingWorkerPath: string;

    beforeAll(() => {
      crashingWorkerPath = path.join(process.env.TEST_TMPDIR, "crashing-worker.cjs");
      fs.writeFileSync(
        crashingWorkerPath,
        `const {parentPort} = require("worker_threads");
         parentPort.on("message", () => { throw new Error("simulated worker crash"); });`
      );
    });

    const meta: BuildMeta = {
      cwd: undefined,
      entrypoints: {build: "index.mjs", runtime: "index.mjs"},
      outDir: ".build"
    };

    beforeEach(() => {
      meta.cwd = FunctionTestBed.initialize(`export default function() {}`, meta);
      return fs.promises.mkdir(path.join(meta.cwd, "node_modules"), {recursive: true});
    });

    // A dying worker emits 'error' and 'exit'; whichever settles the pending build first
    // decides the diagnostic code (CRASH vs EXIT). Both mean "worker died, build fails as a
    // 422", so assert the shape, not the racy code. The test merely completing proves the fix:
    // before it, the unhandled 'error' would crash this jest process.
    it("should reject the build with a diagnostic instead of crashing the process", async () => {
      const builder = new RollupBuilder("javascript", {workerPath: crashingWorkerPath});

      const diagnostics = await builder.build(meta).catch(e => e);

      expect(Array.isArray(diagnostics)).toBe(true);
      expect(diagnostics[0]).toEqual(
        expect.objectContaining({category: 1, text: expect.stringMatching(/worker/i)})
      );

      await builder.kill();
    });

    it("should respawn a fresh worker for the next build after a crash", async () => {
      const builder = new RollupBuilder("javascript", {workerPath: crashingWorkerPath});

      await builder.build(meta).catch(() => {});
      // second attempt spawns a new worker (the crashed one was dropped); it fails the same
      // way, proving a usable worker was created rather than the host being left wedged.
      const second = await builder.build(meta).catch(e => e);

      expect(Array.isArray(second)).toBe(true);
      expect(second[0]).toEqual(
        expect.objectContaining({category: 1, text: expect.stringMatching(/worker/i)})
      );

      await builder.kill();
    });

    // The host is shared per-language across concurrent builds. Worker A's error clears the
    // reference, a concurrent build spawns worker B, then A's trailing exit must NOT drop B or
    // fail B's build. Driving the host directly (run() dispatches synchronously) puts B's spawn
    // in the exact window between A's error and A's exit. Fixture worker: crash on `meta.crash`,
    // otherwise succeed.
    it("should not let a crashed worker's exit fail a concurrent build on a fresh worker", async () => {
      const fixture = path.join(process.env.TEST_TMPDIR, "crash-or-succeed-worker.cjs");
      fs.writeFileSync(
        fixture,
        `const {parentPort} = require("worker_threads");
         parentPort.on("message", ({id, meta}) => {
           if (meta && meta.crash) { throw new Error("simulated worker crash"); }
           parentPort.postMessage({id, diagnostics: []});
         });`
      );

      const host = new RollupWorkerHost(fixture);
      const base = {outDir: ".build", entrypoints: {build: "i", runtime: "i"}};
      const crashMeta = {...base, cwd: "/crash", crash: true} as unknown as BuildMeta;
      const healthyMeta = {...base, cwd: "/healthy"} as unknown as BuildMeta;

      const first = host.run("javascript", crashMeta);
      // dispatch the concurrent build in first's rejection microtask, before A's exit macrotask
      const second = first.then(
        () => undefined,
        () => host.run("javascript", healthyMeta)
      );

      // guard present: B survives A's stale exit and its build resolves.
      // guard removed: A's exit drops B and rejects this build -> the assertion fails.
      await expect(second).resolves.toBeUndefined();

      await host.kill();
    });
  });
});
