import {Compilation} from "@spica-server/function/compiler";
import {Typescript} from "@spica-server/function/compiler/typescript";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import fs from "fs";
import path from "path";

describe("Typescript", () => {
  let language: Typescript;

  const compilation: Compilation = {
    cwd: undefined,
    entrypoints: {build: "index.ts", runtime: "index.mjs"},
    outDir: ".build"
  };

  beforeEach(() => {
    language = new Typescript(process.env.FUNCTION_TS_COMPILER_PATH);
    compilation.cwd = FunctionTestBed.initialize(``, compilation);
    return fs.promises.mkdir(path.join(compilation.cwd, "node_modules"), {recursive: true});
  });

  afterEach(() => language.kill());

  it("should symlink node_modules to .build path", async () => {
    await language.compile(compilation);
    const stat = await fs.promises.lstat(
      path.join(compilation.cwd, compilation.outDir, "node_modules")
    );
    expect(stat.isSymbolicLink()).toBe(true);
  });

  it("should compile entrypoint", async () => {
    compilation.cwd = FunctionTestBed.initialize(`export default function() {}`, compilation);
    await language.compile(compilation);

    const files = fs.readdirSync(path.join(compilation.cwd, compilation.outDir));
    expect(files).toContain(".tsbuildinfo");

    const stat = await fs.promises.readFile(
      path.join(compilation.cwd, compilation.outDir, compilation.entrypoints.runtime)
    );

    expect(stat.toString()).toContain(`export default function () { }
//# sourceMappingURL=index.js.map`);
  });

  it("should report diagnostics", async () => {
    compilation.cwd = FunctionTestBed.initialize(
      `
    import {database} from '@spica-server/database';
    export default function() {
    const a;
    }
    `,
      compilation
    );
    await expect(language.compile(compilation)).rejects.toEqual([
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
    const first: Compilation = {
      cwd: FunctionTestBed.initialize(`const a;`, compilation),
      entrypoints: compilation.entrypoints,
      outDir: compilation.outDir
    };
    const second: Compilation = {
      cwd: FunctionTestBed.initialize(`import {} from 'non-existent-module';`, compilation),
      entrypoints: compilation.entrypoints,
      outDir: compilation.outDir
    };
    const diagnostics = await Promise.all([
      language.compile(first).catch(e => e),
      language.compile(second).catch(e => e)
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
    compilation.cwd = FunctionTestBed.initialize(`export default function() {}`, compilation);
    const indexPath = path.join(compilation.cwd, compilation.entrypoints.build);
    expect(await language.compile(compilation)).not.toBeTruthy();

    await fs.promises.writeFile(indexPath, `const a;`);

    expect(await language.compile(compilation).catch(e => e)).toEqual([
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

    expect(await language.compile(compilation).catch(e => e)).toEqual([
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
