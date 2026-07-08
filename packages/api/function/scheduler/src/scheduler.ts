import path from "path";
import {Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {DatabaseService} from "@spica-server/database";
import {Language} from "@spica-server/function-compiler";
import {Javascript} from "@spica-server/function-compiler-javascript";
import {Typescript} from "@spica-server/function-compiler-typescript";
import {
  DatabaseEnqueuer,
  Enqueuer,
  FirehoseEnqueuer,
  HttpEnqueuer,
  ScheduleEnqueuer,
  SystemEnqueuer,
  RabbitMQEnqueuer,
  GrpcEnqueuer
} from "@spica-server/function-enqueuer";
import {DelegatePkgManager} from "@spica-server/interface-function-pkgmanager";
import {Npm} from "@spica-server/function-pkgmanager-node";
import {LocalPackageManager} from "@spica-server/function-pkgmanager-local";
import {
  DatabaseQueue,
  EventQueue,
  FirehoseQueue,
  HttpQueue,
  RabbitMQQueue,
  GrpcQueue
} from "@spica-server/function-queue";
import {event} from "@spica-server/function-queue-proto";
import {Runtime, Worker} from "@spica-server/function-runtime";
import {
  DatabaseOutput,
  EventLogRouter,
  StandartStream,
  StandardStreamOutput
} from "@spica-server/function-runtime-io";
import {generateLog} from "@spica-server/function-runtime-logger";
import {ClassCommander, JobReducer} from "@spica-server/replication";
import {AttachStatusTracker, ATTACH_STATUS_TRACKER} from "@spica-server/interface-status";
import {GuardService} from "@spica-server/passport-guard-services";
import uniqid from "uniqid";
import {SchedulingOptions, SCHEDULING_OPTIONS} from "@spica-server/interface-function-scheduler";
import {Subject} from "rxjs";
import {take} from "rxjs/operators";
import {ScheduleWorker, Node} from "@spica-server/function-scheduler";
import {LogLevels} from "@spica-server/interface-function-runtime";
import {ENQUEUER, EnqueuerFactory, WorkerState} from "@spica-server/interface-function-scheduler";

@Injectable()
export class Scheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Scheduler.name);

  private queue: EventQueue;
  private httpQueue: HttpQueue;
  private databaseQueue: DatabaseQueue;
  private firehoseQueue: FirehoseQueue;
  private rabbitmqQueue: RabbitMQQueue;
  private grpcQueue: GrpcQueue;

  readonly runtimes = new Map<string, Runtime>();
  readonly pkgmanagers = new Map<string, DelegatePkgManager>();
  readonly enqueuers = new Set<Enqueuer<unknown>>();
  readonly languages = new Map<string, Language>();

  private outputs: StandartStream[];

  constructor(
    private http: HttpAdapterHost,
    private database: DatabaseService,
    @Optional() private commander: ClassCommander,
    @Inject(SCHEDULING_OPTIONS) private options: SchedulingOptions,
    @Optional() @Inject(ENQUEUER) private enqueuerFactory: EnqueuerFactory<unknown, unknown>,
    @Optional() private jobReducer: JobReducer,
    @Optional() @Inject(ATTACH_STATUS_TRACKER) private attachStatusTracker: AttachStatusTracker,
    private guardService: GuardService
  ) {
    this.outputs = this.createOutputs(database);

    this.languages.set("typescript", new Typescript(options.tsCompilerPath));
    this.languages.set("javascript", new Javascript());
    this.runtimes.set("node", new Node());
    this.pkgmanagers.set("node", new LocalPackageManager(new Npm()));

    this.queue = new EventQueue(
      (id, schedule) => this.gotWorker(id, schedule),
      event => this.enqueue(event),
      id => this.cancel(id),
      (id, succedded) => this.complete(id, succedded),
      this.options.functionGrpcMaxMessageSizeBytes
    );

    this.httpQueue = new HttpQueue();
    this.queue.addQueue(this.httpQueue);

    this.databaseQueue = new DatabaseQueue();
    this.queue.addQueue(this.databaseQueue);

    this.firehoseQueue = new FirehoseQueue();
    this.queue.addQueue(this.firehoseQueue);

    this.rabbitmqQueue = new RabbitMQQueue();
    this.queue.addQueue(this.rabbitmqQueue);

    this.grpcQueue = new GrpcQueue();
    this.queue.addQueue(this.grpcQueue);
  }

  async onModuleInit() {
    const schedulerUnsubscription = (targetId: string) => {
      this.outdateWorkers(targetId);
    };

    this.enqueuers.add(
      new HttpEnqueuer(
        this.queue,
        this.httpQueue,
        this.http.httpAdapter.getInstance(),
        this.options.corsOptions,
        schedulerUnsubscription,
        this.guardService,
        this.attachStatusTracker,
        this.options.payloadSizeLimit
      )
    );

    this.enqueuers.add(
      new FirehoseEnqueuer(
        this.queue,
        this.firehoseQueue,
        this.http.httpAdapter.getHttpServer(),
        schedulerUnsubscription
      )
    );

    this.enqueuers.add(
      new DatabaseEnqueuer(
        this.queue,
        this.databaseQueue,
        this.database,
        schedulerUnsubscription,
        this.jobReducer,
        this.commander
      )
    );

    this.enqueuers.add(
      new ScheduleEnqueuer(this.queue, schedulerUnsubscription, this.jobReducer, this.commander)
    );

    this.enqueuers.add(new SystemEnqueuer(this.queue));

    this.enqueuers.add(
      new RabbitMQEnqueuer(
        this.queue,
        this.rabbitmqQueue,
        schedulerUnsubscription,
        this.jobReducer,
        this.commander
      )
    );

    this.enqueuers.add(
      new GrpcEnqueuer(
        this.queue,
        this.grpcQueue,
        this.options.functionGrpcMaxMessageSizeBytes,
        schedulerUnsubscription,
        this.options.grpcPort
      )
    );

    if (typeof this.enqueuerFactory == "function") {
      const factory = this.enqueuerFactory(this.queue, this.jobReducer, this.commander);
      this.queue.addQueue(factory.queue);
      this.enqueuers.add(factory.enqueuer);
    }

    await this.queue.listen();

    this.scaleWorkers();
  }

  private createOutputs(database: DatabaseService): StandartStream[] {
    const workerLogOutput = this.options.workerLogOutput;
    const outputs: StandartStream[] = [];

    if (workerLogOutput?.includes("database")) {
      outputs.push(new DatabaseOutput(database));
    }
    if (workerLogOutput?.includes("stdout")) {
      outputs.push(new StandardStreamOutput());
    }

    return outputs;
  }

  killFreeWorkers() {
    const freeWorkers = Array.from(this.workers.entries()).filter(
      ([key, worker]) =>
        worker.isIdle() &&
        (worker.state == WorkerState.Initial ||
          worker.state == WorkerState.Fresh ||
          worker.state == WorkerState.Targeted ||
          worker.state == WorkerState.Warm ||
          worker.state == WorkerState.Warming)
    );
    const killWorkers = freeWorkers.map(([key, worker]) => {
      return worker.kill();
    });

    return Promise.all(killWorkers);
  }

  waitLastWorkerLost() {
    const lastWorkerHasAlreadLost = this.workers.size == 0;

    return lastWorkerHasAlreadLost
      ? Promise.resolve()
      : this.onLastWorkerLost.asObservable().pipe(take(1)).toPromise();
  }

  killLanguages() {
    return Promise.all(Array.from(this.languages.values()).map(l => l.kill()));
  }

  private disabled = false;

  async onModuleDestroy() {
    // stop replenishing the warm reserve while we tear workers down, otherwise
    // killing warm workers here would immediately respawn them.
    this.disabled = true;

    await this.drainEventQueue();

    await this.killFreeWorkers();
    await this.waitLastWorkerLost();

    await this.killLanguages();

    return this.queue.kill();
  }

  drainEventQueue() {
    const promises = [];
    for (const enqueuer of this.enqueuers.values()) {
      const events = Array.from(this.eventQueue.values()).filter(
        event => event.type == enqueuer.type
      );
      promises.push(enqueuer.onEventsAreDrained(events));
    }

    this.eventQueue.clear();

    return Promise.all(promises);
  }

  workers = new Map<string, ScheduleWorker>();
  onLastWorkerLost = new Subject();

  eventQueue = new Map<string, event.Event>();

  // Keyed by worker id: one timeout per worker, extended on each new event assigned to
  // it (a busy worker's deadline is its most recently started event). Firing kills it.
  timeouts = new Map<string, NodeJS.Timeout>();

  // One demux per concurrent worker (capacity > 1), keyed by worker id.
  logRouters = new Map<string, {stdout: EventLogRouter; stderr: EventLogRouter}>();

  warmConfigs = new Map<string, {desired: number; target: event.Target}>();

  getStatus() {
    const workers = Array.from(this.workers.values());

    const initial = workers.filter(w => w.state == WorkerState.Initial).length;
    const fresh = workers.filter(w => w.state == WorkerState.Fresh).length;
    const warm = workers.filter(
      w => w.state == WorkerState.Warm || w.state == WorkerState.Warming
    ).length;
    const activated = workers.length - initial - fresh - warm;

    return {
      activated: activated,
      fresh: fresh,
      warm: warm,
      unit: "count"
    };
  }

  takeAWorker(target: event.Target): {id: string; worker: ScheduleWorker} | undefined {
    const workers = Array.from(this.workers.entries()).map(([id, worker]) => {
      return {id, worker};
    });

    // 1. Reuse an already-graduated same-target worker that still has a free lane
    // (its module is cache-warm).
    const reusable = workers.find(({worker}) => worker.canServe(target.id));
    if (reusable) {
      return reusable;
    }

    // 2. Tap the pre-warmed reserve — the first-hit and concurrency-burst path.
    const warm = workers.find(({worker}) => worker.canServeWarm(target.id));
    if (warm) {
      return warm;
    }

    // 3. Fall back to the shared cold worker. Warm/Warming workers are intentionally
    // excluded from the concurrency count so the reserve never blocks a cold spawn.
    const activeCount = workers.filter(({worker}) => worker.isActiveFor(target.id)).length;
    if (activeCount < this.options.maxConcurrency) {
      return workers.find(({worker}) => worker.isFresh());
    }
    return;
  }

  process() {
    for (const event of this.eventQueue.values()) {
      const workerMeta = this.takeAWorker(event.target);
      if (!workerMeta) {
        continue;
      }

      const {id: workerId, worker} = workerMeta;

      const streamOptions = {
        eventId: event.id,
        functionId: event.target.id,
        functionName: path.basename(event.target.cwd),
        handler: event.target.handler
      };
      const pairs = this.outputs.map(o => o.create(streamOptions));

      if (worker.capacity > 1) {
        // Concurrent worker: one persistent demux per channel routes each event's
        // framed logs to its own sinks, since detach/attach can't isolate
        // simultaneously-running events sharing the process stdout.
        let routers = this.logRouters.get(workerId);
        if (!routers) {
          routers = {stdout: new EventLogRouter(), stderr: new EventLogRouter()};
          this.logRouters.set(workerId, routers);
          worker.attach(routers.stdout.input, routers.stderr.input);
        }
        routers.stdout.register(
          event.id,
          pairs.map(([stdout]) => stdout)
        );
        routers.stderr.register(
          event.id,
          pairs.map(([, stderr]) => stderr)
        );
      } else {
        worker.detach();
        for (const [stdout, stderr] of pairs) {
          worker.attach(stdout, stderr);
        }
      }

      const timeoutInMs = Math.min(this.options.timeout, event.target.context.timeout) * 1000;

      const msg = `${timeoutInMs / 1000} seconds timeout value has been reached for function '${
        event.target.handler
      }'. The worker is being shut down.`;

      const timeoutMsg = this.options.logger ? generateLog(msg, LogLevels.INFO) : msg;
      const channels = pairs.map(([stdout, stderr]) => (this.options.logger ? stdout : stderr));

      const timeoutFn = () => {
        worker.markAsTimeouted();
        for (const channel of channels) {
          if (channel.writable) {
            channel.write(timeoutMsg);
          }
        }
        worker.kill();
      };

      if (this.timeouts.has(workerId)) {
        clearTimeout(this.timeouts.get(workerId));
      }
      this.timeouts.set(workerId, setTimeout(timeoutFn, timeoutInMs));

      if (this.options.invocationLogs) {
        this.logInvocations(event);
      }

      worker.execute(event);

      this.eventQueue.delete(event.id);

      this.print(`assigning ${event.id} to ${workerId}`);

      this.scaleWorkers();
      this.scaleWarmWorkers(event.target.id);
    }
  }

  logInvocations(ev: event.Event) {
    const log = `fn-invocation-log: ${ev.id} ${ev.target.id} ${ev.target.handler} ${event.Type[ev.type]}`;
    console.log(log);
  }

  enqueue(event: event.Event) {
    this.eventQueue.set(event.id, event);
    this.process();
  }

  cancel(id) {
    this.print(`an event got cancelled ${id}`);
    this.eventQueue.delete(id);
  }

  complete(id: string, succedded: boolean) {
    // The worker's timeout is worker-keyed (extended per event, cleared on death), so a
    // completing event only needs to stop routing its own logs on concurrent workers.
    for (const routers of this.logRouters.values()) {
      routers.stdout.unregister(id);
      routers.stderr.unregister(id);
    }

    this.print(`an event has been completed ${id} with status ${succedded ? "success" : "fail"}`);
  }

  gotWorker(id: string, schedule: (event: event.Event) => void) {
    const relatedWorker = this.workers.get(id);

    if (!relatedWorker || relatedWorker.state == WorkerState.Outdated) {
      this.print(`the worker ${id} won't be scheduled anymore.`);
    } else {
      let message;
      if (relatedWorker.state == WorkerState.Initial) {
        message = `got a new worker ${id}`;
      } else if (relatedWorker.state == WorkerState.Busy) {
        message = `worker ${id} is waiting for new event`;
      }
      relatedWorker.markAsAvailable(schedule);

      this.print(message);
    }

    this.process();
  }

  lostWorker(id: string) {
    const worker = this.workers.get(id);
    // An unexpected death of a ready worker (crash / OOM / external kill after it
    // preloaded) leaves it in Warm state — intentional teardown (trim, outdate) marks
    // it Outdated first, so it won't match here. Refill so a low-traffic function's
    // pre-warmed pool doesn't silently shrink until its next event.
    //
    // We deliberately do NOT refill a worker lost while still Warming: a module that
    // hard-crashes during preload (top-level process.exit / OOM / native crash, which
    // preload()'s try/catch can't intercept) dies in Warming, and refilling there would
    // spin an unthrottled respawn loop. Reaching Warm proves preload succeeds.
    const lostWarmWorker = worker && worker.state == WorkerState.Warm && worker.targetId;

    this.workers.delete(id);

    clearTimeout(this.timeouts.get(id));
    this.timeouts.delete(id);

    this.logRouters.delete(id);

    this.print(`lost a worker ${id}`);

    if (lostWarmWorker && !this.disabled && this.warmConfigs.has(worker.targetId)) {
      this.scaleWarmWorkers(worker.targetId);
    }

    if (!this.workers.size) {
      this.onLastWorkerLost.next("");
    }
  }

  outdateWorkers(targetId: string) {
    Array.from(this.workers.values())
      .filter(worker => worker.hasSameTarget(targetId))
      .forEach(worker => {
        if (worker.state != WorkerState.Outdated) {
          const wasWarm = worker.state == WorkerState.Warm || worker.state == WorkerState.Warming;
          worker.markAsOutdated();
          // Warm workers never execute on their own, so they can't drain by finishing
          // an event — kill them now. The reserve is refilled by the engine's reconcile
          // (which follows every real code/env change with the fresh target).
          if (wasWarm) {
            worker.kill();
          }
        }
      });
  }

  private scaleWorkers() {
    const hasFreshWorker = Array.from(this.workers.values()).find(worker => worker.isFresh());

    if (hasFreshWorker) {
      return;
    }

    this.spawnWorker();
  }

  private spawnWorker(extraEnv: {[key: string]: string} = {}): ScheduleWorker {
    const id: string = uniqid();
    const node = this.runtimes.get("node") as Node;
    const env: {[key: string]: string} = {
      __INTERNAL__SPICA__MONGOURL__: this.options.databaseUri,
      __INTERNAL__SPICA__MONGODBNAME__: this.options.databaseName,
      __INTERNAL__SPICA__MONGOREPL__: this.options.databaseReplicaSet,
      __INTERNAL__SPICA__PUBLIC_URL__: this.options.apiUrl,
      __EXPERIMENTAL_DEVKIT_DATABASE_CACHE: this.options.experimentalDevkitDatabaseCache
        ? "true"
        : "",
      ...extraEnv
    };

    if (this.options.logger) {
      env.LOGGER = "true";
    }
    if (this.options.functionGrpcMaxMessageSizeBytes) {
      env.FUNCTION_GRPC_MAX_MESSAGE_SIZE = String(this.options.functionGrpcMaxMessageSizeBytes);
    }
    if (this.options.maxConcurrencyPerWorker) {
      env.WORKER_MAX_CONCURRENCY = String(this.options.maxConcurrencyPerWorker);
    }

    const worker = node.spawn({
      id,
      concurrency: this.options.maxConcurrencyPerWorker,
      env,
      entrypointPath: this.options.spawnEntrypointPath
    });

    worker.once("exit", () => this.lostWorker(id));

    this.workers.set(id, worker);

    return worker;
  }

  /**
   * Declare how many pre-warmed workers a function should keep on standby.
   * Idempotent: called once per active trigger of the function, and with 0 when
   * the function/trigger is removed. The count is clamped to `maxWarmWorkers`.
   */
  reconcileWarmWorkers(target: event.Target, desired: number) {
    const fnId = target.id;
    const clamped = Math.max(0, Math.min(desired || 0, this.options.maxWarmWorkers || 0));

    if (clamped == 0) {
      this.warmConfigs.delete(fnId);
    } else {
      this.warmConfigs.set(fnId, {desired: clamped, target});
    }

    this.scaleWarmWorkers(fnId);
  }

  private scaleWarmWorkers(fnId: string) {
    const config = this.warmConfigs.get(fnId);
    const desired = config ? config.desired : 0;

    const warmWorkers = Array.from(this.workers.values()).filter(
      worker =>
        worker.hasSameTarget(fnId) &&
        (worker.state == WorkerState.Warm || worker.state == WorkerState.Warming)
    );

    if (config && warmWorkers.length < desired) {
      for (let i = warmWorkers.length; i < desired; i++) {
        this.spawnWarmWorker(config.target);
      }
    } else if (warmWorkers.length > desired) {
      // trim in-flight spawns first so the ready, immediately-servable reserve is kept
      const ordered = warmWorkers.sort((a, b) =>
        a.state == WorkerState.Warming ? -1 : b.state == WorkerState.Warming ? 1 : 0
      );
      for (const worker of ordered.slice(0, warmWorkers.length - desired)) {
        worker.markAsOutdated();
        worker.kill();
      }
    }
  }

  private spawnWarmWorker(target: event.Target) {
    const env = (target.context?.env || []).reduce(
      (acc, e) => {
        acc[e.key] = e.value;
        return acc;
      },
      {} as {[key: string]: string}
    );

    const worker = this.spawnWorker({
      WARM: "true",
      WARM_CWD: target.cwd,
      WARM_ENV: JSON.stringify(env)
    });

    worker.markAsWarming(target);
  }

  /**
   * ATTENTION: Do not use this method since it is only designed for testing.
   */
  kill() {
    this.queue.kill();
  }

  private print(message: string) {
    if (this.options.debug) {
      this.logger.debug(message);
    }
  }
}
