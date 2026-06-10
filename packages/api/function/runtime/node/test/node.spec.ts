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
    it("should pipe stdout to the attached stream and track it", done => {
      const worker = createWorker();
      const output = new PassThrough();
      let received = 0;

      output.on("data", () => received++);

      worker.attach(output, undefined);

      expect(worker["_attachedStdouts"]).toContain(output);

      mockStdout.push("hello");

      setImmediate(() => {
        expect(received).toBe(1);
        done();
      });
    });

    it("should pipe stderr to the attached stream and track it", done => {
      const worker = createWorker();
      const output = new PassThrough();
      let received = 0;

      output.on("data", () => received++);

      worker.attach(undefined, output);

      expect(worker["_attachedStderrs"]).toContain(output);

      mockStderr.push("error");

      setImmediate(() => {
        expect(received).toBe(1);
        done();
      });
    });
  });

  describe("detach", () => {
    it("should unpipe every attached stream and clear the tracking arrays", () => {
      const worker = createWorker();
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const stdoutUnpipe = jest.spyOn(mockStdout, "unpipe");
      const stderrUnpipe = jest.spyOn(mockStderr, "unpipe");

      worker.attach(stdout, stderr);
      worker.detach();

      expect(stdoutUnpipe).toHaveBeenCalledWith(stdout);
      expect(stderrUnpipe).toHaveBeenCalledWith(stderr);
      expect(worker["_attachedStdouts"]).toEqual([]);
      expect(worker["_attachedStderrs"]).toEqual([]);
    });

    it("should not accumulate pipes across executions: data goes only to the current stream", done => {
      const worker = createWorker();

      // Each "execution" gets a brand new output stream (as the scheduler does),
      // and detaches the previous one before attaching the new one.
      const received: number[] = [];
      const runExecution = (index: number) => {
        const output = new PassThrough();
        output.on("data", () => (received[index] = (received[index] || 0) + 1));
        worker.detach();
        worker.attach(output, undefined);
      };

      runExecution(0);
      runExecution(1);
      runExecution(2);

      // A single log line emitted by the worker after three executions must be
      // delivered exactly once, to the most recent stream only.
      mockStdout.push("hello");

      setImmediate(() => {
        expect(received[0]).toBeUndefined();
        expect(received[1]).toBeUndefined();
        expect(received[2]).toBe(1);
        done();
      });
    });
  });
});
