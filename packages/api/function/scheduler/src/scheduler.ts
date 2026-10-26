import path from "path";
import {Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {DatabaseService} from "@spica-server/database";
import {Builder} from "@spica-server/function-builder";
import {LegacyBuilder} from "@spica-server/function-builder-legacy";
import {RollupBuilder} from "@spica-server/function-builder-rollup";
import {BuilderType, SUPPORTED_LANGUAGES} from "@spica-server/interface-function-builder";
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
import {
  ENQUEUER,
  EnqueuerFactory,
  WorkerState,
  DEFAULT_EVENT_CONCURRENCY,
  DEFAULT_CUTOVER_GRACE_MS
} from "@spica-server/interface-function-scheduler";

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
  readonly builders = new Map<string, Builder>();

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

    for (const language of SUPPORTED_LANGUAGES) {
      this.builders.set(language, this.createBuilder(language));
    }

    this.runtimes.set("node", new Node());
    this.pkgmanagers.set("node", new LocalPackageManager(new Npm()));

    this.queue = new EventQueue(
      (id, push) => this.workerSubscribed(id, push),
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
    this.enqueuers.add(
      new HttpEnqueuer(
        this.queue,
        this.httpQueue,
        this.http.httpAdapter.getInstance(),
        this.options.corsOptions,
        this.guardService,
        this.attachStatusTracker,
        this.options.payloadSizeLimit
      )
    );

    this.enqueuers.add(
      new FirehoseEnqueuer(this.queue, this.firehoseQueue, this.http.httpAdapter.getHttpServer())
    );

    this.enqueuers.add(
      new DatabaseEnqueuer(
        this.queue,
        this.databaseQueue,
        this.database,
        this.jobReducer,
        this.commander
      )
    );

    this.enqueuers.add(new ScheduleEnqueuer(this.queue, this.jobReducer, this.commander));

    this.enqueuers.add(new SystemEnqueuer(this.queue));

    this.enqueuers.add(new RabbitMQEnqueuer(this.queue, this.rabbitmqQueue));

    this.enqueuers.add(
      new GrpcEnqueuer(
        this.queue,
        this.grpcQueue,
        this.options.functionGrpcMaxMessageSizeBytes,
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

  killBuilders() {
    return Promise.all(Array.from(this.builders.values()).map(b => b.kill()));
  }

  private createBuilder(language: string): Builder {
    return this.options.builder == BuilderType.Rollup
      ? new RollupBuilder(language, {
          workerPath: this.options.rollupWorkerPath,
          maxOldSpaceMb: this.options.builderMaxMemoryMb
        })
      : new LegacyBuilder(language, {tsCompilerPath: this.options.tsCompilerPath});
  }

  private disabled = false;

  async onModuleDestroy() {
    this.disabled = true;

    for (const timer of this.supersedeTimers.values()) {
      clearTimeout(timer);
    }
    this.supersedeTimers.clear();

    await this.drainEventQueue();

    await this.killFreeWorkers();
    await this.waitLastWorkerLost();

    await this.killBuilders();

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

  timeouts = new Map<string, NodeJS.Timeout>();

  eventToWorker = new Map<string, string>();

  logRouters = new Map<string, {stdout: EventLogRouter; stderr: EventLogRouter}>();

  warmConfigs = new Map<string, {desired: number; target: event.Target}>();

  replacementConfigs = new Map<string, {desired: number; target: event.Target}>();

  supersedeTimers = new Map<string, NodeJS.Timeout>();

  concurrencyConfigs = new Map<string, number>();

  contextConfigs = new Map<string, event.SchedulingContext>();

  getStatus() {
    const functions: Record<
      string,
      {
        warming: number;
        warm: number;
        idle: number;
        busy: number;
        superseded: number;
        retiring: number;
      }
    > = {};
    const spare = {initial: 0, fresh: 0};

    for (const worker of this.workers.values()) {
      const targetId = worker.targetId;

      if (!targetId) {
        if (worker.state == WorkerState.Fresh) {
          spare.fresh++;
        } else {
          spare.initial++;
        }
        continue;
      }

      const counts = (functions[targetId] ??= {
        warming: 0,
        warm: 0,
        idle: 0,
        busy: 0,
        superseded: 0,
        retiring: 0
      });

      if (worker.state == WorkerState.Outdated || worker.state == WorkerState.Timeouted) {
        counts.retiring++;
      } else if (worker.isSuperseded) {
        counts.superseded++;
      } else if (worker.state == WorkerState.Warming) {
        counts.warming++;
      } else if (worker.state == WorkerState.Warm) {
        counts.warm++;
      } else if (worker.state == WorkerState.Busy) {
        counts.busy++;
      } else {
        counts.idle++;
      }
    }

    return {functions, spare, unit: "count"};
  }

  takeAWorker(target: event.Target): {id: string; worker: ScheduleWorker} | undefined {
    const workers = Array.from(this.workers.entries()).map(([id, worker]) => {
      return {id, worker};
    });

    const reusable = workers.find(({worker}) => worker.canServe(target.id));
    if (reusable) {
      return reusable;
    }

    const warm = workers.find(({worker}) => worker.canServeWarm(target.id));
    if (warm) {
      return warm;
    }

    const superseded = workers.find(({worker}) => worker.canServeSuperseded(target.id));
    if (superseded) {
      return superseded;
    }

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

      const activatingFreshWorker = worker.state == WorkerState.Warm;

      worker.setCapacity(this.concurrencyConfigs.get(event.target.id) ?? DEFAULT_EVENT_CONCURRENCY);

      const streamOptions = {
        eventId: event.id,
        functionId: event.target.id,
        functionName: path.basename(event.target.cwd),
        handler: event.target.handler
      };
      const pairs = this.outputs.map(o => o.create(streamOptions));

      if (worker.capacity > 1) {
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

      this.eventToWorker.set(event.id, workerId);
      worker.execute(event);

      this.eventQueue.delete(event.id);

      this.print(`assigning ${event.id} to ${workerId}`);

      if (activatingFreshWorker) {
        this.retireOneSuperseded(event.target.id);
      }

      this.scaleWorkers();
      this.scaleWarmWorkers(event.target.id);
    }
  }

  logInvocations(ev: event.Event) {
    const log = `fn-invocation-log: ${ev.id} ${ev.target.id} ${ev.target.handler} ${event.Type[ev.type]}`;
    console.log(log);
  }

  enqueue(ev: event.Event) {
    ev.target.context =
      this.contextConfigs.get(ev.target.id) ??
      ev.target.context ??
      new event.SchedulingContext({env: [], timeout: this.options.timeout});
    this.eventQueue.set(ev.id, ev);
    this.process();
  }

  cancel(id) {
    this.print(`an event got cancelled ${id}`);
    this.eventQueue.delete(id);
  }

  complete(id: string, succedded: boolean) {
    const workerId = this.eventToWorker.get(id);
    this.eventToWorker.delete(id);

    if (workerId) {
      const worker = this.workers.get(workerId);
      worker?.onComplete();

      const routers = this.logRouters.get(workerId);
      if (routers) {
        routers.stdout.unregister(id);
        routers.stderr.unregister(id);
      }
    }

    this.print(`an event has been completed ${id} with status ${succedded ? "success" : "fail"}`);

    this.process();
  }

  workerSubscribed(id: string, push: (event: event.Event) => void) {
    const worker = this.workers.get(id);

    if (!worker || worker.state == WorkerState.Outdated) {
      this.print(`the worker ${id} won't be scheduled anymore.`);
      return;
    }

    worker.subscribed(push);
    this.print(`worker ${id} subscribed`);

    this.process();
  }

  lostWorker(id: string) {
    const worker = this.workers.get(id);
    const lostWarmWorker =
      worker && worker.state == WorkerState.Warm && !worker.isReplacement && worker.targetId;

    const lostReplacementWorker =
      worker && worker.state == WorkerState.Warm && worker.isReplacement && worker.targetId;

    this.workers.delete(id);

    clearTimeout(this.timeouts.get(id));
    this.timeouts.delete(id);

    for (const [eventId, wId] of this.eventToWorker) {
      if (wId == id) {
        this.eventToWorker.delete(eventId);
      }
    }

    this.logRouters.delete(id);

    this.print(`lost a worker ${id}`);

    if (lostWarmWorker && !this.disabled && this.warmConfigs.has(worker.targetId)) {
      this.scaleWarmWorkers(worker.targetId);
    }

    if (lostReplacementWorker && !this.disabled) {
      const replacementConfig = this.replacementConfigs.get(lostReplacementWorker);
      if (replacementConfig) {
        this.scaleReplacementWorkers(replacementConfig.target, replacementConfig.desired);
      }
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
          if (wasWarm) {
            worker.kill();
          }
        }
      });

    this.clearReplacementState(targetId);
  }

  supersedeWorkers(target: event.Target) {
    const fnId = target.id;
    const workers = Array.from(this.workers.values()).filter(worker => worker.hasSameTarget(fnId));

    for (const worker of workers) {
      if (worker.state == WorkerState.Warm || worker.state == WorkerState.Warming) {
        worker.markAsOutdated();
        worker.kill();
      }
    }

    const active = workers.filter(
      worker => worker.state == WorkerState.Targeted || worker.state == WorkerState.Busy
    );

    if (active.length == 0) {
      this.clearReplacementState(fnId);
      return;
    }

    for (const worker of active) {
      worker.markAsSuperseded();
    }

    this.scaleReplacementWorkers(target, active.length);

    const grace = this.options.functionWorkerCutoverGraceMs ?? DEFAULT_CUTOVER_GRACE_MS;
    if (this.supersedeTimers.has(fnId)) {
      clearTimeout(this.supersedeTimers.get(fnId));
    }
    this.supersedeTimers.set(
      fnId,
      setTimeout(() => this.forceCutover(fnId), grace)
    );
  }

  private retireOneSuperseded(fnId: string) {
    const stale = Array.from(this.workers.values()).find(
      worker =>
        worker.hasSameTarget(fnId) &&
        worker.isSuperseded &&
        worker.state != WorkerState.Outdated &&
        worker.state != WorkerState.Timeouted
    );

    if (stale) {
      stale.markAsOutdated();
    }

    const remaining = Array.from(this.workers.values()).some(
      worker =>
        worker.hasSameTarget(fnId) && worker.isSuperseded && worker.state != WorkerState.Outdated
    );

    if (!remaining) {
      this.clearReplacementState(fnId);
    }
  }

  private forceCutover(fnId: string) {
    Array.from(this.workers.values())
      .filter(
        worker =>
          worker.hasSameTarget(fnId) && worker.isSuperseded && worker.state != WorkerState.Outdated
      )
      .forEach(worker => worker.markAsOutdated());

    this.clearReplacementState(fnId);
  }

  private clearReplacementState(fnId: string) {
    this.replacementConfigs.delete(fnId);

    if (this.supersedeTimers.has(fnId)) {
      clearTimeout(this.supersedeTimers.get(fnId));
      this.supersedeTimers.delete(fnId);
    }

    Array.from(this.workers.values())
      .filter(
        worker =>
          worker.hasSameTarget(fnId) &&
          worker.isReplacement &&
          (worker.state == WorkerState.Warm || worker.state == WorkerState.Warming)
      )
      .forEach(worker => {
        worker.markAsOutdated();
        worker.kill();
      });
  }

  private scaleReplacementWorkers(target: event.Target, desired: number) {
    const fnId = target.id;

    if (desired <= 0) {
      this.clearReplacementState(fnId);
      return;
    }

    this.replacementConfigs.set(fnId, {desired, target});

    const replacements = Array.from(this.workers.values()).filter(
      worker =>
        worker.hasSameTarget(fnId) &&
        worker.isReplacement &&
        (worker.state == WorkerState.Warm || worker.state == WorkerState.Warming)
    );

    if (replacements.length < desired) {
      for (let i = replacements.length; i < desired; i++) {
        this.spawnReplacementWorker(target);
      }
    } else if (replacements.length > desired) {
      const ordered = replacements.sort((a, b) =>
        a.state == WorkerState.Warming ? -1 : b.state == WorkerState.Warming ? 1 : 0
      );
      for (const worker of ordered.slice(0, replacements.length - desired)) {
        worker.markAsOutdated();
        worker.kill();
      }
    }
  }

  private spawnReplacementWorker(target: event.Target) {
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

    worker.markAsReplacement();
    worker.markAsWarming(target);
  }

  private scaleWorkers() {
    const hasFreshWorker = Array.from(this.workers.values()).find(
      worker => worker.isFresh() || worker.state == WorkerState.Initial
    );

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
    const worker = node.spawn({
      id,
      env,
      entrypointPath: this.options.spawnEntrypointPath
    });

    worker.once("exit", () => this.lostWorker(id));

    this.workers.set(id, worker);

    return worker;
  }

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

  reconcileConcurrency(target: event.Target, concurrency: number) {
    const max = this.options.eventConcurrency || DEFAULT_EVENT_CONCURRENCY;
    const clamped = Math.max(
      DEFAULT_EVENT_CONCURRENCY,
      Math.min(concurrency || DEFAULT_EVENT_CONCURRENCY, max)
    );

    if (clamped == DEFAULT_EVENT_CONCURRENCY) {
      this.concurrencyConfigs.delete(target.id);
    } else {
      this.concurrencyConfigs.set(target.id, clamped);
    }
  }

  reconcileContext(target: event.Target, context: event.SchedulingContext | null) {
    if (context) {
      this.contextConfigs.set(target.id, context);
    } else {
      this.contextConfigs.delete(target.id);
    }
  }

  private scaleWarmWorkers(fnId: string) {
    const config = this.warmConfigs.get(fnId);
    const desired = config ? config.desired : 0;

    const warmWorkers = Array.from(this.workers.values()).filter(
      worker =>
        worker.hasSameTarget(fnId) &&
        !worker.isReplacement &&
        (worker.state == WorkerState.Warm || worker.state == WorkerState.Warming)
    );

    if (config && warmWorkers.length < desired) {
      for (let i = warmWorkers.length; i < desired; i++) {
        this.spawnWarmWorker(config.target);
      }
    } else if (warmWorkers.length > desired) {
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
