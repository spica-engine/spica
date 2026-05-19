import child_process from "child_process";
import {PassThrough} from "stream";
import {NodeWorker} from "../src/node";

describe("NodeWorker", () => {
  let spawnSpy: jest.SpyInstance;
  let mockStdout: PassThrough;
  let mockStderr: PassThrough;
  let mockProcess: any;

  beforeEach(() => {
    mockStdout = new PassThrough();
    mockStderr = new PassThrough();
    mockProcess = {
      stdout: mockStdout,
      stderr: mockStderr,
      kill: jest.fn(),
      once: jest.fn().mockReturnThis(),
      killed: false
    };
    spawnSpy = jest.spyOn(child_process, "spawn").mockReturnValue(mockProcess as any);
  });

  afterEach(() => {
    spawnSpy.mockRestore();
  });

  function createWorker(): NodeWorker {
    return new NodeWorker({id: "test-id", env: {}, entrypointPath: "fake-path"});
  }

  describe("attach", () => {
    it("should only pipe stdout once when the same stream is attached multiple times", () => {
      const worker = createWorker();
      const output = new PassThrough();
      const pipeSpy = jest.spyOn(mockStdout, "pipe");
      const unpipeSpy = jest.spyOn(mockStdout, "unpipe");

      worker.attach(output, undefined);
      worker.attach(output, undefined);

      expect(unpipeSpy).toHaveBeenCalledTimes(1);
      expect(unpipeSpy).toHaveBeenCalledWith(output);
      expect(pipeSpy).toHaveBeenCalledTimes(2);
    });

    it("should only pipe stderr once when the same stream is attached multiple times", () => {
      const worker = createWorker();
      const output = new PassThrough();
      const pipeSpy = jest.spyOn(mockStderr, "pipe");
      const unpipeSpy = jest.spyOn(mockStderr, "unpipe");

      worker.attach(undefined, output);
      worker.attach(undefined, output);

      expect(unpipeSpy).toHaveBeenCalledTimes(1);
      expect(unpipeSpy).toHaveBeenCalledWith(output);
      expect(pipeSpy).toHaveBeenCalledTimes(2);
    });

    it("should deliver stdout data exactly once when the same stream is attached multiple times", done => {
      const worker = createWorker();
      const output = new PassThrough();
      let received = 0;

      output.on("data", () => received++);

      worker.attach(output, undefined);
      worker.attach(output, undefined);

      mockStdout.push("hello");

      setImmediate(() => {
        expect(received).toBe(1);
        done();
      });
    });

    it("should deliver stderr data exactly once when the same stream is attached multiple times", done => {
      const worker = createWorker();
      const output = new PassThrough();
      let received = 0;

      output.on("data", () => received++);

      worker.attach(undefined, output);
      worker.attach(undefined, output);

      mockStderr.push("error");

      setImmediate(() => {
        expect(received).toBe(1);
        done();
      });
    });
  });
});
