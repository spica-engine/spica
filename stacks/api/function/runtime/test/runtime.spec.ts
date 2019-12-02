import {Compilation, Runtime} from "@spica-server/function/runtime";
import * as fs from "fs";

class FooRuntime extends Runtime {
  name: string;

  execute(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  compile(compilation: Compilation): Promise<void> {
    throw new Error("Method not implemented.");
  }

  _prepare(compilation: Compilation) {
    return this.prepare(compilation);
  }
}

describe("Runtime", () => {
  let runtime: FooRuntime;

  const compilation: Compilation = {cwd: "/tmp/fn1", entrypoint: "index.ts"};

  beforeEach(() => {
    runtime = new FooRuntime();
  });

  afterEach(async () => {
    await fs.promises.rmdir("/tmp/fn1/.build");
    await fs.promises.rmdir("/tmp/fn1");
  });

  it("should create .build directory", async () => {
    expect(await fs.promises.stat("/tmp/fn1/.build").catch(() => null)).toBe(null);
    await runtime._prepare(compilation);
    const stat = await fs.promises.stat("/tmp/fn1/.build");
    expect(stat.isDirectory()).toBe(true);
  });
});
