import {Compilation} from "@spica-server/function/compiler";
import {Typescript} from "@spica-server/function/compiler/typescript";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import * as fs from "fs";
import * as path from "path";

jest.setTimeout(20000);

describe("Typescript", () => {
  let language: Typescript;

  const compilation: Compilation = {
    cwd: undefined,
    entrypoint: "index.ts"
  };

  beforeEach(() => {
    language = new Typescript();
    compilation.cwd = FunctionTestBed.initialize(``);
    return fs.promises.mkdir(path.join(compilation.cwd, "node_modules"), {recursive: true});
  });

  afterEach(() => language.kill());

  it("should symlink node_modules to .build path", async () => {
    await language.compile(compilation);
    const stat = await fs.promises.lstat(path.join(compilation.cwd, ".build", "node_modules"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  it("should compile entrypoint", async () => {
    compilation.cwd = FunctionTestBed.initialize(`export default function() {}`);
    await language.compile(compilation);

    const files = fs.readdirSync(path.join(compilation.cwd, ".build"));
    expect(files).toContain(".tsbuildinfo");

    const stat = await fs.promises.readFile(path.join(compilation.cwd, ".build", "index.js"));

    expect(stat.toString()).toContain("exports.default = default_1");
  });

  it("should report diagnostics", async () => {
    compilation.cwd = FunctionTestBed.initialize(`
    import {database} from '@spica-server/database';
    export default function() {
    const a;
    }
    `);
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
      cwd: FunctionTestBed.initialize(`const a;`),
      entrypoint: "index.ts"
    };
    const second: Compilation = {
      cwd: FunctionTestBed.initialize(`import {} from 'non-existent-module';`),
      entrypoint: "index.ts"
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
    compilation.cwd = FunctionTestBed.initialize(`export default function() {}`);
    const indexPath = path.join(compilation.cwd, "index.ts");
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
        text:
          "Cannot find name 'test'. Do you need to install type definitions for a test runner? Try `npm i @types/jest` or `npm i @types/mocha`.",
        start: {line: 1, column: 1},
        end: {line: 1, column: 5}
      }
    ]);
  });
});
