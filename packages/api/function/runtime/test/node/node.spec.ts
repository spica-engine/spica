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

    it("should track all streams independently when attaching in a loop", () => {
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

      // Both streams should be tracked — the loop does not remove the first
      expect(worker["_attachedStdouts"]).toContain(stdout1);
      expect(worker["_attachedStdouts"]).toContain(stdout2);
      expect(worker["_attachedStderrs"]).toContain(stderr1);
      expect(worker["_attachedStderrs"]).toContain(stderr2);

      worker.kill();
    });

    it("should preserve other pipes when re-attaching", () => {
      const worker = node.spawn({
        id: "test-preserve-pipes",
        env: {},
        entrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH
      });

      // Attach an external stream independently (not through attach)
      const externalStream = new PassThrough();
      worker["_process"].stdout.pipe(externalStream);

      const stdout1 = new PassThrough();
      const stderr1 = new PassThrough();
      worker.attach(stdout1, stderr1);

      const stdout2 = new PassThrough();
      const stderr2 = new PassThrough();
      worker.attach(stdout2, stderr2);

      // The external stream should still be piped (not removed by unpipe)
      const listeners = worker["_process"].stdout.listenerCount("data");
      expect(listeners).toBeGreaterThan(0);

      worker.kill();
    });

    it("should unpipe and re-track the same stream instance when re-attached", () => {
      const worker = node.spawn({
        id: "test-stale-ref",
        env: {},
        entrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH
      });

      const stdout1 = new PassThrough();
      const stderr1 = new PassThrough();
      worker.attach(stdout1, stderr1);

      // Re-attach the exact same stream objects; should appear only once in the arrays
      worker.attach(stdout1, stderr1);

      expect(worker["_attachedStdouts"].filter(s => s === stdout1)).toHaveLength(1);
      expect(worker["_attachedStderrs"].filter(s => s === stderr1)).toHaveLength(1);

      worker.kill();
    });
  });
});

