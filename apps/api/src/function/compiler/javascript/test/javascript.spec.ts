import {Compilation} from "../../../../../../../libs/interface/function/compiler";
import {Javascript} from "..";
import {FunctionTestBed} from "../../../runtime/testing";
import fs from "fs";
import path from "path";

describe("Javascript", () => {
  let language: Javascript;

  const compilation: Compilation = {
    cwd: undefined,
    entrypoints: {build: "index.mjs", runtime: "index.mjs"},
    outDir: ".build"
  };

  beforeEach(() => {
    language = new Javascript();
    compilation.cwd = FunctionTestBed.initialize(``, compilation);
    return fs.promises.mkdir(path.join(compilation.cwd, "node_modules"), {recursive: true});
  });

  it("should symlink node_modules to .build path", async () => {
    await language.compile(compilation);
    const stat = await fs.promises.lstat(path.join(compilation.cwd, ".build", "node_modules"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  it("should copy file as is", async () => {
    const content = "export default function() {};";
    compilation.cwd = FunctionTestBed.initialize(content, compilation);
    await language.compile(compilation);

    const builtFileContent = await fs.promises.readFile(
      path.join(compilation.cwd, compilation.outDir, language.description.entrypoints.runtime)
    );

    expect(builtFileContent.toString()).toContain(content);
  });
});
