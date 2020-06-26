import {Compilation} from "@spica-server/function/compiler";
import {Javascript} from "@spica-server/function/compiler/javascript";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import * as fs from "fs";
import * as path from "path";

describe("Javascript", () => {
  let language: Javascript;

  const compilation: Compilation = {
    cwd: undefined,
    entrypoint: undefined
  };

  beforeEach(() => {
    language = new Javascript();
    compilation.entrypoint = `index.${language.description.extension}`;
    compilation.cwd = FunctionTestBed.initialize(``, compilation.entrypoint);
    return fs.promises.mkdir(path.join(compilation.cwd, "node_modules"), {recursive: true});
  });

  it("should symlink node_modules to .build path", async () => {
    await language.compile(compilation);
    const stat = await fs.promises.lstat(path.join(compilation.cwd, ".build", "node_modules"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  it("should copy file as is", async () => {
    const content = "export default function() {};";
    compilation.cwd = FunctionTestBed.initialize(content, compilation.entrypoint);
    await language.compile(compilation);

    const builtFileContent = await fs.promises.readFile(
      path.join(compilation.cwd, ".build", "index.mjs")
    );

    expect(builtFileContent.toString()).toContain(content);
  });

  it("should symlink @spica-devkit/database to @internal/database", async () => {
    compilation.cwd = FunctionTestBed.initialize(
      `export default function() {}`,
      compilation.entrypoint
    );
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

    await language.compile(compilation);
    const stat = await fs.promises.lstat(
      path.join(compilation.cwd, ".build", "node_modules", "@internal", "database")
    );
    expect(stat.isSymbolicLink()).toBe(true);
  });
});
