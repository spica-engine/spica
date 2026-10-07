import fs from "fs";
import os from "os";
import path from "path";
import {FunctionPreparationService} from "@spica-server/function/src/function-preparation.service";

describe("FunctionPreparationService.tryBuild", () => {
  const fn = {name: "my-function", language: "typescript"} as any;
  let root: string;
  let builder: {build: jest.Mock; description: any};
  let service: FunctionPreparationService;

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "preparation-"));
    builder = {
      build: jest.fn().mockResolvedValue(undefined),
      description: {entrypoints: {build: "index.ts", runtime: "index.mjs"}}
    };
    const scheduler = {builders: new Map([["typescript", builder]])};
    service = new FunctionPreparationService(scheduler as any, {
      root,
      outDir: ".build",
      timeout: 1
    });
    await fs.promises.mkdir(path.join(root, fn.name));
  });

  afterEach(() => fs.promises.rm(root, {recursive: true, force: true}));

  it("should skip the build when the function has no index yet", async () => {
    await expect(service.tryBuild(fn)).resolves.toBe(true);
    expect(builder.build).not.toHaveBeenCalled();
  });

  it("should build when the index exists", async () => {
    await fs.promises.writeFile(path.join(root, fn.name, "index.ts"), "export default 1");

    await expect(service.tryBuild(fn)).resolves.toBe(true);
    expect(builder.build).toHaveBeenCalledTimes(1);
  });

  it("should report a failed build without throwing", async () => {
    await fs.promises.writeFile(path.join(root, fn.name, "index.ts"), "export default 1");
    builder.build.mockRejectedValueOnce(new Error("tsc"));
    jest.spyOn((service as any).logger, "error").mockImplementation(() => {});

    await expect(service.tryBuild(fn)).resolves.toBe(false);
  });
});
