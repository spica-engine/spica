import {BuildMeta} from "@spica-server/interface-function-builder";
import {JavascriptBuild} from "@spica-server/function-builder-legacy";
import {FunctionTestBed} from "@spica-server/function/runtime/testing";
import fs from "fs";
import path from "path";

describe("JavascriptBuild", () => {
  let builder: JavascriptBuild;

  const meta: BuildMeta = {
    cwd: undefined,
    entrypoints: {build: "index.mjs", runtime: "index.mjs"},
    outDir: ".build"
  };

  beforeEach(() => {
    builder = new JavascriptBuild();
    meta.cwd = FunctionTestBed.initialize(``, meta);
    return fs.promises.mkdir(path.join(meta.cwd, "node_modules"), {recursive: true});
  });

  it("should symlink node_modules to .build path", async () => {
    await builder.build(meta);
    const stat = await fs.promises.lstat(path.join(meta.cwd, ".build", "node_modules"));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  it("should copy file as is", async () => {
    const content = "export default function() {};";
    meta.cwd = FunctionTestBed.initialize(content, meta);
    await builder.build(meta);

    const builtFileContent = await fs.promises.readFile(
      path.join(meta.cwd, meta.outDir, builder.description.entrypoints.runtime)
    );

    expect(builtFileContent.toString()).toContain(content);
  });
});
