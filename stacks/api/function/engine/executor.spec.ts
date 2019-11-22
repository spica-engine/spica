import {NodeExecutor} from "./executor";
import * as fs from "fs";
import * as path from "path";

class ExecutionEnvironment {
  readonly cwd = "/tmp/functions/test";

  init(script: string) {
    fs.mkdirSync(this.cwd, {recursive: true});
    fs.writeFileSync(path.join(this.cwd, "index.ts"), script);
  }

  destroy() {
    fs.unlinkSync(path.join(this.cwd, "index.ts"));
    fs.rmdirSync(this.cwd);
  }
}

describe("NodeExecutor", () => {
  let executor: NodeExecutor;
  let environment = new ExecutionEnvironment();

  beforeEach(() => {
    executor = new NodeExecutor();
    environment.destroy();
  });

  it("should spin up new process", async () => {
    environment.init(`
    export default function() {

    }
    `);
    const result = await executor.execute({
      cwd: environment.cwd,
      context: null,
      logger: null,
      memoryLimit: 1000,
      timeout: 100,
      parameters: [],
      script: ""
    });

    expect(result).toBe(2);
  });
});
