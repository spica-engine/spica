import {Node} from "@spica-server/function-scheduler";
import {PassThrough, Writable} from "stream";

describe("Node", () => {
  let node: Node;

  beforeEach(async () => {
    node = new Node();
  });

  it("should kill the process", () => {
    const worker = node.spawn({
      id: "test",
      env: {},
      entrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH
    });
    expect(worker["_process"].killed).toEqual(false);
    worker.kill();
    expect(worker["_process"].killed).toEqual(true);
  });

  describe("attach", () => {
    it("should pipe process stdout and stderr to the given streams", done => {
      const worker = node.spawn({
        id: "test-attach",
        env: {},
        entrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      const stdout = new Writable({
        write(chunk, _enc, cb) {
          stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          cb();
        }
      });
      const stderr = new Writable({
        write(chunk, _enc, cb) {
          stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          cb();
        }
      });

      worker.attach(stdout, stderr);

      expect(worker["_attachedStdouts"]).toContain(stdout);
      expect(worker["_attachedStderrs"]).toContain(stderr);

      worker.kill().then(done);
    });

    it("should track all streams independently when attaching in a loop", async () => {
      const worker = node.spawn({
        id: "test-loop-attach",
        env: {},
        entrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH
      });

      const stdout1 = new PassThrough();
      const stderr1 = new PassThrough();
      worker.attach(stdout1, stderr1);

      const stdout2 = new PassThrough();
      const stderr2 = new PassThrough();
      worker.attach(stdout2, stderr2);

      expect(worker["_attachedStdouts"]).toContain(stdout1);
      expect(worker["_attachedStdouts"]).toContain(stdout2);
      expect(worker["_attachedStderrs"]).toContain(stderr1);
      expect(worker["_attachedStderrs"]).toContain(stderr2);

      await worker.kill();
    });

    it("should detach all attached streams", async () => {
      const worker = node.spawn({
        id: "test-detach",
        env: {},
        entrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH
      });

      const stdout = new PassThrough();
      const stderr = new PassThrough();
      worker.attach(stdout, stderr);

      worker.detach();

      expect(worker["_attachedStdouts"]).toEqual([]);
      expect(worker["_attachedStderrs"]).toEqual([]);
      expect(worker["_process"].stdout.listenerCount("data")).toEqual(0);

      await worker.kill();
    });
  });
});

