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

    this.enqueuers.add(
      new RabbitMQEnqueuer(this.queue, this.rabbitmqQueue, this.jobReducer, this.commander)
    );

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

  killLanguages() {
    return Promise.all(Array.from(this.languages.values()).map(l => l.kill()));
  }

  private disabled = false;

  async onModuleDestroy() {
    // stop replenishing the warm reserve while we tear workers down, otherwise
    // killing warm workers here would immediately respawn them.
    this.disabled = true;

    // drop pending cutover grace timers so none fires mid-teardown.
    for (const timer of this.supersedeTimers.values()) {
      clearTimeout(timer);
    }
    this.supersedeTimers.clear();

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

  // event id -> worker id, so a completing event decrements the right worker's in-flight
  // count (freeing a slot) and stops routing its logs.
  eventToWorker = new Map<string, string>();

  // One demux per concurrent worker (capacity > 1), keyed by worker id.
  logRouters = new Map<string, {stdout: EventLogRouter; stderr: EventLogRouter}>();

  warmConfigs = new Map<string, {desired: number; target: event.Target}>();

  // Transient per-function state for a rolling cutover (function updated under traffic). Holds
  // the fresh target and how many new-code replacement workers to pre-warm — one per worker that
  // was serving at update time. Independent of warmConfigs (the steady-state reserve) so the
  // feature works even when a function's warmWorkers is 0. Cleared when the cutover completes.
  replacementConfigs = new Map<string, {desired: number; target: event.Target}>();

  // Per-function grace timer armed on supersede: if the replacements never become ready (e.g. the
  // new version crashes on preload), it force-outdates the surviving superseded workers so the new
  // code runs and its errors surface instead of the stale code masking a broken deploy.
  supersedeTimers = new Map<string, NodeJS.Timeout>();

  // Per-function event concurrency (already clamped to the global max), keyed by function
  // id, fed in-memory by the engine on function create/update. A worker pinned to a
  // function gets this as its capacity. Absent -> 1.
  concurrencyConfigs = new Map<string, number>();

  // Per-function execution context (env + timeout), keyed by function id, fed by the engine
  // whenever env/secret/timeout change. Stamped onto every event at enqueue time so a cold
  // worker gets the current values without the trigger subscription carrying them — which is
  // what lets an env change refresh workers without tearing down and rebuilding the route.
  contextConfigs = new Map<string, event.SchedulingContext>();

  getStatus() {
    const workers = Array.from(this.workers.values());

    const initial = workers.filter(w => w.state == WorkerState.Initial).length;
    const fresh = workers.filter(w => w.state == WorkerState.Fresh).length;
    const warm = workers.filter(
      w => w.state == WorkerState.Warm || w.state == WorkerState.Warming
    ).length;
    const activated = workers.length - initial - fresh - warm;
    const superseded = workers.filter(w => w.isSuperseded && w.state != WorkerState.Outdated).length;

    return {
      activated: activated,
      fresh: fresh,
      warm: warm,
      superseded: superseded,
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

    // 2. Tap the pre-warmed reserve (steady-state reserve or a rolling-cutover replacement —
    // both hold fresh code). The first-hit and concurrency-burst path.
    const warm = workers.find(({worker}) => worker.canServeWarm(target.id));
    if (warm) {
      return warm;
    }

    // 3. Mid-cutover, no fresh replacement ready yet: keep serving from a still-hot superseded
    // (old-code) worker rather than paying a cold start. It's retired the moment a replacement
    // graduates and takes over.
    const superseded = workers.find(({worker}) => worker.canServeSuperseded(target.id));
    if (superseded) {
      return superseded;
    }

    // 4. Fall back to the shared cold worker. Warm/Warming workers are intentionally
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

      // A fresh-code worker going active (from the warm reserve or a cutover replacement) is the
      // signal to retire one stale worker — captured before execute() transitions it off Warm.
      const activatingFreshWorker = worker.state == WorkerState.Warm;

      // Pin this worker to the function's concurrency the moment it's assigned. Set before
      // the capacity>1 log-demux decision and before execute()'s Busy/Targeted transition.
      worker.setCapacity(this.concurrencyConfigs.get(event.target.id) ?? DEFAULT_EVENT_CONCURRENCY);

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
      // Free the slot on this event's worker so the scheduler can push it the next queued
      // event, and stop routing this event's logs on a concurrent worker.
      const worker = this.workers.get(workerId);
      worker?.onComplete();

      // A retired (superseded → outdated) worker that just drained its last in-flight event is
      // done and would otherwise linger; reap it now. Guarded to Outdated so live workers, which
      // go Busy→Targeted here and get reused, are never killed.
      if (worker && worker.state == WorkerState.Outdated && worker.isIdle()) {
        worker.kill();
      }

      const routers = this.logRouters.get(workerId);
      if (routers) {
        routers.stdout.unregister(id);
        routers.stderr.unregister(id);
      }
    }

    this.print(`an event has been completed ${id} with status ${succedded ? "success" : "fail"}`);

    this.process();
  }

  // Called once, when a worker opens its event stream. The stream is its readiness signal
  // and its delivery channel; the scheduler pushes events down it up to the worker's
  // capacity. There is no per-event handshake.
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
    // An unexpected death of a ready worker (crash / OOM / external kill after it
    // preloaded) leaves it in Warm state — intentional teardown (trim, outdate) marks
    // it Outdated first, so it won't match here. Refill so a low-traffic function's
    // pre-warmed pool doesn't silently shrink until its next event.
    //
    // We deliberately do NOT refill a worker lost while still Warming: a module that
    // hard-crashes during preload (top-level process.exit / OOM / native crash, which
    // preload()'s try/catch can't intercept) dies in Warming, and refilling there would
    // spin an unthrottled respawn loop. Reaching Warm proves preload succeeds.
    const lostWarmWorker =
      worker && worker.state == WorkerState.Warm && !worker.isReplacement && worker.targetId;

    // Same reasoning for a ready cutover replacement: refill so the rolling cutover doesn't stall
    // on a crashed replacement, but never for one lost while still Warming (crash-loop guard).
    const lostReplacementWorker =
      worker && worker.state == WorkerState.Warm && worker.isReplacement && worker.targetId;

    this.workers.delete(id);

    clearTimeout(this.timeouts.get(id));
    this.timeouts.delete(id);

    // In-flight events on a dead worker won't complete; drop their mappings so they don't
    // leak (they're already out of eventQueue, so they aren't reprocessed).
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
          // Warm workers never execute on their own, so they can't drain by finishing
          // an event — kill them now. The reserve is refilled by the engine's reconcile
          // (which follows every real code/env change with the fresh target).
          if (wasWarm) {
            worker.kill();
          }
        }
      });

    // A hard outdate ends any rolling cutover in progress for this function (it's being deleted or
    // deactivated), so drop its transient cutover state now instead of leaving it for the grace
    // timer to reap.
    this.clearReplacementState(targetId);
  }

  /**
   * Roll a function's workers over to fresh state without a cold-start gap. Instead of outdating
   * live workers immediately (which forces the next event to cold-spawn), it keeps them serving the
   * old code as "superseded" and pre-warms one fresh replacement per serving worker. `takeAWorker`
   * then prefers the replacements; as each is consumed, one superseded worker is retired. Every
   * pre-warmed worker (the steady-state reserve and any in-flight replacements from an earlier
   * update) is killed here since it holds now-stale code; the reserve is refilled by
   * reconcileWarmWorkers afterwards and replacements are respawned from this newest target.
   */
  supersedeWorkers(target: event.Target) {
    const fnId = target.id;
    const workers = Array.from(this.workers.values()).filter(worker => worker.hasSameTarget(fnId));

    // Kill every pre-warmed worker of this function — the steady-state reserve AND any in-flight
    // replacements from an earlier cutover. All of them preloaded now-stale code (a second update
    // landing mid-warming makes the first update's replacements stale), so none can be reused:
    // reconcileWarmWorkers refills the reserve and scaleReplacementWorkers respawns replacements,
    // both from the newest target.
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
      // nothing is serving — no rolling cutover needed. Drop any stale in-flight cutover state.
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

  // Retire one superseded (old-code) worker now that a fresh replacement has taken over. Idle
  // workers are reaped immediately; busy ones finish their in-flight events and are reaped by
  // complete(). When the last superseded worker of the function is retired, the cutover is done.
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
      if (stale.isIdle()) {
        stale.kill();
      }
    }

    const remaining = Array.from(this.workers.values()).some(
      worker =>
        worker.hasSameTarget(fnId) && worker.isSuperseded && worker.state != WorkerState.Outdated
    );

    if (!remaining) {
      this.clearReplacementState(fnId);
    }
  }

  // Grace timer fired: replacements never took over (typically a new version that crashes on
  // preload). Force the surviving superseded workers to fresh code so the failure surfaces instead
  // of the old code silently masking a broken deploy.
  private forceCutover(fnId: string) {
    Array.from(this.workers.values())
      .filter(
        worker =>
          worker.hasSameTarget(fnId) && worker.isSuperseded && worker.state != WorkerState.Outdated
      )
      .forEach(worker => {
        worker.markAsOutdated();
        if (worker.isIdle()) {
          worker.kill();
        }
      });

    this.clearReplacementState(fnId);
  }

  // The cutover is over (all superseded workers retired, or forced): drop the transient config and
  // kill any replacement that was pre-warmed but never needed so it doesn't linger.
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
      // a re-update shrank the set — trim in-flight spawns first, keep the ready ones
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
    const worker = node.spawn({
      id,
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

  /**
   * Declare how many events a function runs in parallel per worker. Clamped to the global
   * `eventConcurrency` max cap. A worker pinned to this function reads the value as its
   * capacity on its next assignment, so a live edit takes effect without respawning:
   * growing lets the worker take more events, shrinking simply stops new ones until it
   * drains below the new limit.
   *
   * `concurrencyConfigs` is a SPARSE map: only functions ABOVE the default are stored;
   * passing the default (or a removed function) drops the entry, and consumers read back
   * `?? DEFAULT_EVENT_CONCURRENCY`. So "reset to default" and "clear" are the same call.
   */
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

  /**
   * Declare the execution context (env + timeout) events of a function carry. A null context
   * clears the entry (function removed), after which events fall back to the global default.
   */
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

    // Replacements are the rolling-cutover pool, sized independently of warmWorkers — exclude them
    // so this steady-state reconcile neither counts nor trims them.
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
