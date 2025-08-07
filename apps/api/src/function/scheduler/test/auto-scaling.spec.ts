import {Test, TestingModule} from "@nestjs/testing";
import {PassThrough} from "stream";
import {EventQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {Scheduler} from "../src/scheduler";
import {SchedulerModule} from "../src/scheduler.module";
import {SchedulingOptions, WorkerState} from "@spica-server/interface/function/scheduler";
import {ScheduleWorker, Node} from "../src/worker";

describe("Auto-scaling", () => {
  let app: TestingModule;
  let scheduler: Scheduler;
  let spawnSpy: jest.SpyInstance<ScheduleWorker, any>;

  const schedulerOptions: SchedulingOptions = {
    databaseUri: "mongodb://localhost:27017/test",
    databaseName: "test",
    databaseReplicaSet: "",
    apiUrl: "http://localhost:3000",
    timeout: 60,
    corsOptions: {
      allowedOrigins: ["*"],
      allowedMethods: ["*"],
      allowedHeaders: ["*"],
      allowCredentials: false
    },
    maxConcurrency: 2,
    debug: true,
    logger: false,
    invocationLogs: false,
    spawnEntrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH,
    tsCompilerPath: process.env.FUNCTION_TS_COMPILER_PATH,
    autoScaling: {
      enabled: true,
      minWorkers: 0,
      maxWorkers: 5,
      scaleUpThreshold: 0.7,
      scaleDownThreshold: 0.3,
      workerIdleTimeout: 1000, // 1 second for quick testing
      scaleCooldown: 500, // 0.5 seconds for quick testing
      targetResponseTime: 1000
    }
  };

  const compilation = {
    cwd: "/tmp/test",
    entrypoints: {
      build: "index.mjs",
      runtime: "index.mjs"
    },
    outDir: ".build"
  };

  function allWorkers() {
    return Array.from(scheduler["workers"].entries());
  }

  function getWorkersByState(state: WorkerState) {
    return allWorkers().filter(([id, worker]) => worker.state === state);
  }

  function simulateEvent(functionId: string = "test-function") {
    const ev = new event.Event({
      target: new event.Target({
        id: functionId,
        cwd: compilation.cwd,
        handler: "default",
        context: new event.SchedulingContext({env: [], timeout: schedulerOptions.timeout})
      }),
      type: -1 as any
    });
    scheduler.enqueue(ev);
    return ev;
  }

  function completeEvent(eventId: string) {
    scheduler["complete"](eventId, true);
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet(), SchedulerModule.forRoot(schedulerOptions)]
    }).compile();

    app = module;
    scheduler = module.get(Scheduler);

    // Mock the node runtime spawn method
    const node = scheduler["runtimes"].get("node") as Node;
    spawnSpy = jest.spyOn(node, "spawn");
    spawnSpy.mockImplementation(options => {
      const worker = new ScheduleWorker(options);

      // Mock the process to avoid actual spawning
      (worker as any)._process = {
        killed: false,
        stdout: {unpipe: jest.fn(), pipe: jest.fn()},
        stderr: {unpipe: jest.fn(), pipe: jest.fn()},
        once: jest.fn(),
        kill: jest.fn(() => {
          (worker as any)._process.killed = true;
          (worker as any)._quit = true;
        })
      };

      // Simulate the worker becoming available after a short delay
      setTimeout(() => {
        scheduler["gotWorker"](options.id, jest.fn());
      }, 10);

      return worker;
    });

    jest.useFakeTimers();
  });

  afterEach(async () => {
    scheduler.kill();
    await app.close();
    jest.useRealTimers();
    spawnSpy.mockReset();
  });

  describe("Scale Up", () => {
    it("should start with no workers when auto-scaling is enabled", () => {
      expect(allWorkers().length).toBe(0);
      expect(spawnSpy).toHaveBeenCalledTimes(0);
    });

    it("should spawn worker when first event is enqueued", async () => {
      simulateEvent();

      // Advance timers to trigger worker availability
      jest.advanceTimersByTime(100);

      expect(spawnSpy).toHaveBeenCalledTimes(1);
      expect(allWorkers().length).toBe(1);
    });

    it("should spawn additional worker when queue utilization is high", async () => {
      // Create multiple events to increase queue utilization
      simulateEvent("func1");
      simulateEvent("func1");
      simulateEvent("func1");

      jest.advanceTimersByTime(100);

      // Should spawn workers due to high queue utilization
      expect(spawnSpy).toHaveBeenCalledTimes(2);
      expect(allWorkers().length).toBe(2);
    });

    it("should not exceed max workers limit", async () => {
      // Create many events
      for (let i = 0; i < 10; i++) {
        simulateEvent(`func${i}`);
      }

      jest.advanceTimersByTime(1000);

      // Should not exceed maxWorkers (5)
      expect(allWorkers().length).toBeLessThanOrEqual(schedulerOptions.autoScaling.maxWorkers);
    });
  });

  describe("Scale Down", () => {
    beforeEach(async () => {
      // Start with some workers
      simulateEvent();
      simulateEvent();
      jest.advanceTimersByTime(100);

      // Ensure we have workers
      expect(allWorkers().length).toBeGreaterThan(0);
    });

    it("should terminate idle workers after timeout", async () => {
      const initialWorkerCount = allWorkers().length;

      // Advance time beyond idle timeout
      jest.advanceTimersByTime(schedulerOptions.autoScaling.workerIdleTimeout + 1000);

      // Should have fewer workers now
      expect(allWorkers().length).toBeLessThan(initialWorkerCount);
    });

    it("should respect cooldown period between scaling actions", async () => {
      const initialWorkerCount = allWorkers().length;

      // Advance time less than cooldown period
      jest.advanceTimersByTime(schedulerOptions.autoScaling.scaleCooldown - 100);

      // Should not scale down yet
      expect(allWorkers().length).toBe(initialWorkerCount);

      // Advance past cooldown
      jest.advanceTimersByTime(200);

      // Now should be able to scale down
      expect(allWorkers().length).toBeLessThanOrEqual(initialWorkerCount);
    });

    it("should not go below minimum workers", async () => {
      // Test with minimum workers set to 1 via options
      await app.close();

      const minWorkerOptions = {
        ...schedulerOptions,
        autoScaling: {
          ...schedulerOptions.autoScaling,
          minWorkers: 1
        }
      };

      const module = await Test.createTestingModule({
        imports: [DatabaseTestingModule.replicaSet(), SchedulerModule.forRoot(minWorkerOptions)]
      }).compile();

      app = module;
      scheduler = module.get(Scheduler);

      // Start with some events to create workers
      simulateEvent();
      jest.advanceTimersByTime(100);

      // Wait for scale down
      jest.advanceTimersByTime(minWorkerOptions.autoScaling.workerIdleTimeout + 2000);

      // Should maintain minimum workers
      expect(allWorkers().length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Metrics", () => {
    it("should track worker metrics", async () => {
      simulateEvent();
      jest.advanceTimersByTime(100);

      const workers = allWorkers();
      expect(workers.length).toBeGreaterThan(0);

      const [workerId] = workers[0];
      const metrics = scheduler["workerMetrics"].get(workerId);

      expect(metrics).toBeDefined();
      expect(metrics.spawnTime).toBeGreaterThan(0);
      expect(metrics.lastUsed).toBeGreaterThan(0);
      expect(metrics.executionCount).toBeGreaterThanOrEqual(0);
    });

    it("should track queue metrics", async () => {
      simulateEvent();

      const loadMetrics = scheduler["loadMetrics"];
      expect(loadMetrics.queueSize).toBeGreaterThan(0);
      expect(loadMetrics.pendingEvents).toBeGreaterThan(0);
    });

    it("should provide comprehensive status", async () => {
      simulateEvent();
      simulateEvent();
      jest.advanceTimersByTime(100);

      const status = scheduler.getStatus();

      expect(status).toHaveProperty("total");
      expect(status).toHaveProperty("activated");
      expect(status).toHaveProperty("fresh");
      expect(status).toHaveProperty("busy");
      expect(status).toHaveProperty("targeted");
      expect(status).toHaveProperty("queueSize");
      expect(status).toHaveProperty("averageResponseTime");
      expect(status.unit).toBe("count");
    });
  });

  describe("Legacy Mode", () => {
    beforeEach(async () => {
      // Recreate scheduler with auto-scaling disabled
      await app.close();

      const legacyOptions = {
        ...schedulerOptions,
        autoScaling: {enabled: false}
      };

      const module = await Test.createTestingModule({
        imports: [DatabaseTestingModule.replicaSet(), SchedulerModule.forRoot(legacyOptions)]
      }).compile();

      app = module;
      scheduler = module.get(Scheduler);

      // Reset the spy for the new scheduler instance
      const node = scheduler["runtimes"].get("node") as Node;
      spawnSpy = jest.spyOn(node, "spawn");
      spawnSpy.mockImplementation(options => {
        const worker = new ScheduleWorker(options);

        (worker as any)._process = {
          killed: false,
          stdout: {unpipe: jest.fn(), pipe: jest.fn()},
          stderr: {unpipe: jest.fn(), pipe: jest.fn()},
          once: jest.fn(),
          kill: jest.fn(() => {
            (worker as any)._process.killed = true;
            (worker as any)._quit = true;
          })
        };

        setTimeout(() => {
          scheduler["gotWorker"](options.id, jest.fn());
        }, 10);

        return worker;
      });
    });

    it("should spawn worker on module init when auto-scaling is disabled", () => {
      // In legacy mode, should spawn one worker immediately
      expect(spawnSpy).toHaveBeenCalledTimes(1);
      expect(allWorkers().length).toBe(1);
    });

    it("should use legacy scaling behavior", async () => {
      simulateEvent();
      jest.advanceTimersByTime(100);

      // Should use old scaling logic
      expect(allWorkers().length).toBeGreaterThan(0);
    });
  });
});
