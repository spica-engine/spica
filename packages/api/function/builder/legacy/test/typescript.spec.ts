import {BuildMeta} from "@spica-server/interface-function-builder";
import {TypescriptBuild} from "@spica-server/function-builder-legacy";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import fs from "fs";
import path from "path";

describe("TypescriptBuild", () => {
  let builder: TypescriptBuild;

  const meta: BuildMeta = {
    cwd: undefined,
    entrypoints: {build: "index.ts", runtime: "index.mjs"},
    outDir: ".build"
  };

  beforeEach(() => {
    builder = new TypescriptBuild(process.env.FUNCTION_TS_COMPILER_PATH);
    meta.cwd = FunctionTestBed.initialize(``, meta);
    return fs.promises.mkdir(path.join(meta.cwd, "node_modules"), {recursive: true});
  });

  afterEach(() => builder.kill());

  it("should symlink node_modules to .build path", async () => {
    await builder.build(meta);
    const stat = await fs.promises.lstat(path.join(meta.cwd, meta.outDir, "node_modules"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  it("should compile entrypoint", async () => {
    meta.cwd = FunctionTestBed.initialize(`export default function() {}`, meta);
    await builder.build(meta);

    const files = fs.readdirSync(path.join(meta.cwd, meta.outDir));
    expect(files).toContain(".tsbuildinfo");

    const stat = await fs.promises.readFile(
      path.join(meta.cwd, meta.outDir, meta.entrypoints.runtime)
    );

    expect(stat.toString()).toContain(`export default function () { }
//# sourceMappingURL=index.js.map`);
  });

  it("should report diagnostics", async () => {
    meta.cwd = FunctionTestBed.initialize(
      `
    import {database} from '@spica-server/database';
    export default function() {
    const a;
    }
    `,
      meta
    );
    await expect(builder.build(meta)).rejects.toEqual([
      Object({
        code: 2307,
        category: 1,
        text: "Cannot find module '@spica-server/database' or its corresponding type declarations.",
        start: Object({line: 2, column: 28}),
        end: Object({line: 2, column: 52})
      }),
      Object({
        code: 1155,
        category: 1,
        text: "'const' declarations must be initialized.",
        start: Object({line: 4, column: 11}),
        end: Object({line: 4, column: 12})
      })
    ]);
  });

  it("should report diagnostics for multiple functions", async () => {
    const first: BuildMeta = {
      cwd: FunctionTestBed.initialize(`const a;`, meta),
      entrypoints: meta.entrypoints,
      outDir: meta.outDir
    };
    const second: BuildMeta = {
      cwd: FunctionTestBed.initialize(`import {} from 'non-existent-module';`, meta),
      entrypoints: meta.entrypoints,
      outDir: meta.outDir
    };
    const diagnostics = await Promise.all([
      builder.build(first).catch(e => e),
      builder.build(second).catch(e => e)
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
          text: "Cannot find module 'non-existent-module' or its corresponding type declarations.",
          start: {line: 1, column: 16},
          end: {line: 1, column: 37}
        }
      ]
    ]);
  });

  it("should report diagnostics incrementally", async () => {
    meta.cwd = FunctionTestBed.initialize(`export default function() {}`, meta);
    const indexPath = path.join(meta.cwd, meta.entrypoints.build);
    expect(await builder.build(meta)).not.toBeTruthy();

    await fs.promises.writeFile(indexPath, `const a;`);

    expect(await builder.build(meta).catch(e => e)).toEqual([
      {
        code: 1155,
        category: 1,
        text: "'const' declarations must be initialized.",
        start: {line: 1, column: 7},
        end: {line: 1, column: 8}
      }
    ]);

    // to make test harsher
    await fs.promises.writeFile(indexPath, `const b;`);

    await fs.promises.writeFile(indexPath, `test();`);

    expect(await builder.build(meta).catch(e => e)).toEqual([
      {
        code: 2582,
        category: 1,
        text: "Cannot find name 'test'. Do you need to install type definitions for a test runner? Try `npm i --save-dev @types/jest` or `npm i --save-dev @types/mocha`.",
        start: {line: 1, column: 1},
        end: {line: 1, column: 5}
      }
    ]);
  });
});
