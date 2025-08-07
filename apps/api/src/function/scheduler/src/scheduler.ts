import {Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {DatabaseService} from "@spica-server/database";
import {Language} from "@spica-server/function/compiler";
import {Javascript} from "@spica-server/function/compiler/javascript";
import {Typescript} from "@spica-server/function/compiler/typescript";
import {
  DatabaseEnqueuer,
  Enqueuer,
  FirehoseEnqueuer,
  HttpEnqueuer,
  ScheduleEnqueuer,
  SystemEnqueuer,
  RabbitMQEnqueuer
} from "@spica-server/function/enqueuer";
import {DelegatePkgManager} from "@spica-server/function/pkgmanager";
import {Npm} from "@spica-server/function/pkgmanager/node";
import {LocalPackageManager} from "@spica-server/function/pkgmanager/local";
import {
  DatabaseQueue,
  EventQueue,
  FirehoseQueue,
  HttpQueue,
  RabbitMQQueue
} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import {Runtime, Worker} from "@spica-server/function/runtime";
import {DatabaseOutput, StandartStream} from "@spica-server/function/runtime/io";
import {generateLog} from "@spica-server/function/runtime/logger";
import {ClassCommander, JobReducer} from "@spica-server/replication";
import {CommandType} from "@spica-server/interface/replication";
import {AttachStatusTracker, ATTACH_STATUS_TRACKER} from "@spica-server/interface/status";
import uniqid from "uniqid";
import {SchedulingOptions, SCHEDULING_OPTIONS} from "@spica-server/interface/function/scheduler";
import {Subject} from "rxjs";
import {take} from "rxjs/operators";
import {ScheduleWorker, Node} from "@spica-server/function/scheduler";
import {LogLevels} from "@spica-server/interface/function/runtime";
import {ENQUEUER, EnqueuerFactory, WorkerState} from "@spica-server/interface/function/scheduler";

interface WorkerMetrics {
  spawnTime: number;
  lastUsed: number;
  executionCount: number;
  averageResponseTime: number;
}

interface LoadMetrics {
  queueSize: number;
  responseTimeHistory: number[];
  lastScaleAction: number;
  pendingEvents: number;
}

@Injectable()
export class Scheduler implements OnModuleInit, OnModuleDestroy {
  private queue: EventQueue;
  private httpQueue: HttpQueue;
  private databaseQueue: DatabaseQueue;
  private firehoseQueue: FirehoseQueue;
  private rabbitmqQueue: RabbitMQQueue;

  readonly runtimes = new Map<string, Runtime>();
  readonly pkgmanagers = new Map<string, DelegatePkgManager>();
  readonly enqueuers = new Set<Enqueuer<unknown>>();
  readonly languages = new Map<string, Language>();

  private output: StandartStream;

  // Auto-scaling metrics and configuration
  private workerMetrics = new Map<string, WorkerMetrics>();
  private loadMetrics: LoadMetrics = {
    queueSize: 0,
    responseTimeHistory: [],
    lastScaleAction: 0,
    pendingEvents: 0
  };

  // Auto-scaling configuration
  private readonly SCALE_UP_THRESHOLD: number;
  private readonly SCALE_DOWN_THRESHOLD: number;
  private readonly WORKER_IDLE_TIMEOUT: number;
  private readonly MIN_WORKERS: number;
  private readonly MAX_WORKERS: number;
  private readonly SCALE_COOLDOWN: number;
  private readonly RESPONSE_TIME_WINDOW = 10; // Keep last 10 response times
  private readonly TARGET_RESPONSE_TIME: number;
  private readonly AUTO_SCALING_ENABLED: boolean;

  private scaleDownTimer: NodeJS.Timeout;

  constructor(
    private http: HttpAdapterHost,
    private database: DatabaseService,
    @Optional() private commander: ClassCommander,
    @Inject(SCHEDULING_OPTIONS) private options: SchedulingOptions,
    @Optional() @Inject(ENQUEUER) private enqueuerFactory: EnqueuerFactory<unknown, unknown>,
    @Optional() private jobReducer: JobReducer,
    @Optional() @Inject(ATTACH_STATUS_TRACKER) private attachStatusTracker: AttachStatusTracker
  ) {
    if (this.commander) {
      this.commander.register(this, [this.outdateWorkers], CommandType.SYNC);
    }

    this.output = new DatabaseOutput(database);

    // Configure auto-scaling parameters
    const autoScaling = options.autoScaling || {};
    this.AUTO_SCALING_ENABLED = autoScaling.enabled !== false; // Default to enabled
    this.SCALE_UP_THRESHOLD = autoScaling.scaleUpThreshold || 0.7;
    this.SCALE_DOWN_THRESHOLD = autoScaling.scaleDownThreshold || 0.3;
    this.WORKER_IDLE_TIMEOUT = autoScaling.workerIdleTimeout || 300000; // 5 minutes
    this.MIN_WORKERS = autoScaling.minWorkers || 0;
    this.MAX_WORKERS = autoScaling.maxWorkers || Math.max(10, options.maxConcurrency * 2);
    this.SCALE_COOLDOWN = autoScaling.scaleCooldown || 30000; // 30 seconds
    this.TARGET_RESPONSE_TIME = autoScaling.targetResponseTime || 1000; // 1 second

    this.languages.set("typescript", new Typescript(options.tsCompilerPath));
    this.languages.set("javascript", new Javascript());
    this.runtimes.set("node", new Node());
    this.pkgmanagers.set("node", new LocalPackageManager(new Npm()));

    this.queue = new EventQueue(
      (id, schedule) => this.gotWorker(id, schedule),
      event => this.enqueue(event),
      id => this.cancel(id),
      (id, succedded) => this.complete(id, succedded)
    );

    this.httpQueue = new HttpQueue();
    this.queue.addQueue(this.httpQueue);

    this.databaseQueue = new DatabaseQueue();
    this.queue.addQueue(this.databaseQueue);

    this.firehoseQueue = new FirehoseQueue();
    this.queue.addQueue(this.firehoseQueue);

    this.rabbitmqQueue = new RabbitMQQueue();
    this.queue.addQueue(this.rabbitmqQueue);
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
        this.attachStatusTracker
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

    if (typeof this.enqueuerFactory == "function") {
      const factory = this.enqueuerFactory(this.queue, this.jobReducer, this.commander);
      this.queue.addQueue(factory.queue);
      this.enqueuers.add(factory.enqueuer);
    }

    await this.queue.listen();

    // Start with no workers - they will be created on demand
    if (this.AUTO_SCALING_ENABLED) {
      this.print("Scheduler initialized with auto-scaling enabled");
      this.startAutoScaling();
    } else {
      this.print("Scheduler initialized with auto-scaling disabled, using legacy scaling");
      this.scaleWorkers(); // Legacy behavior
    }
  }

  killFreeWorkers() {
    const freeWorkers = Array.from(this.workers.entries()).filter(
      ([key, worker]) =>
        worker.state == WorkerState.Initial ||
        worker.state == WorkerState.Fresh ||
        worker.state == WorkerState.Targeted
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

  async onModuleDestroy() {
    // Stop auto-scaling timer
    if (this.scaleDownTimer) {
      clearInterval(this.scaleDownTimer);
    }

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

  timeouts = new Map<string, NodeJS.Timeout>();

  getStatus() {
    const workers = Array.from(this.workers.values());

    const initial = workers.filter(w => w.state == WorkerState.Initial).length;
    const fresh = workers.filter(w => w.state == WorkerState.Fresh).length;
    const busy = workers.filter(w => w.state == WorkerState.Busy).length;
    const targeted = workers.filter(w => w.state == WorkerState.Targeted).length;
    const activated = workers.length - initial - fresh;

    const averageResponseTime =
      this.loadMetrics.responseTimeHistory.length > 0
        ? this.loadMetrics.responseTimeHistory.reduce((a, b) => a + b, 0) /
          this.loadMetrics.responseTimeHistory.length
        : 0;

    return {
      total: workers.length,
      activated: activated,
      fresh: fresh,
      busy: busy,
      targeted: targeted,
      queueSize: this.eventQueue.size,
      averageResponseTime: Math.round(averageResponseTime),
      unit: "count"
    };
  }

  takeAWorker(target: event.Target): {id: string; worker: ScheduleWorker} {
    const workers = Array.from(this.workers.entries()).map(([id, worker]) => {
      return {id, worker};
    });

    const sameTargets = workers.filter(({worker}) => worker.hasSameTarget(target.id));

    const available = sameTargets.find(
      ({worker}) =>
        worker.state != WorkerState.Busy &&
        worker.state != WorkerState.Timeouted &&
        worker.state != WorkerState.Outdated
    );
    if (available) {
      return available;
    }

    const fresh = workers.find(({worker}) => worker.state == WorkerState.Fresh);
    if (sameTargets.length < this.options.maxConcurrency) {
      return fresh;
    }
    return;
  }

  process() {
    this.loadMetrics.queueSize = this.eventQueue.size;
    this.loadMetrics.pendingEvents = this.eventQueue.size;

    for (const event of this.eventQueue.values()) {
      const startTime = Date.now();
      const workerMeta = this.takeAWorker(event.target);

      if (!workerMeta) {
        if (this.AUTO_SCALING_ENABLED) {
          // No worker available, trigger immediate scaling
          this.scaleUpIfNeeded(event.target);
        } else {
          // Legacy behavior - spawn worker immediately
          this.scaleWorkers();
        }
        continue;
      }

      const {id: workerId, worker} = workerMeta;

      // Update worker metrics
      this.updateWorkerMetrics(workerId, startTime);

      const [stdout, stderr] = this.output.create({
        eventId: event.id,
        functionId: event.target.id
      });
      worker.attach(stdout, stderr);

      const timeoutInMs = Math.min(this.options.timeout, event.target.context.timeout) * 1000;

      const msg = `${timeoutInMs / 1000} seconds timeout value has been reached for function '${
        event.target.handler
      }'. The worker is being shut down.`;

      const timeoutMsg = this.options.logger ? generateLog(msg, LogLevels.INFO) : msg;
      const channel = this.options.logger ? stdout : stderr;

      const timeoutFn = () => {
        worker.markAsTimeouted();
        if (channel.writable) {
          channel.write(timeoutMsg);
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

      // Update response time metrics when event completes
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeMetrics(responseTime);
    }
  }

  logInvocations(ev: event.Event) {
    const log = `fn-invocation-log: ${ev.id} ${ev.target.id} ${ev.target.handler} ${event.Type[ev.type]}`;
    console.log(log);
  }

  enqueue(event: event.Event) {
    this.eventQueue.set(event.id, event);
    this.loadMetrics.pendingEvents = this.eventQueue.size;
    this.process();
  }

  cancel(id) {
    this.print(`an event got cancelled ${id}`);
    this.eventQueue.delete(id);
  }
  complete(id: string, succedded: boolean) {
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
    this.workers.delete(id);
    this.workerMetrics.delete(id);

    clearTimeout(this.timeouts.get(id));
    this.timeouts.delete(id);

    this.print(`lost a worker ${id}`);

    if (!this.workers.size) {
      this.onLastWorkerLost.next("");
    }
  }

  outdateWorkers(targetId: string) {
    Array.from(this.workers.values())
      .filter(worker => worker.hasSameTarget(targetId))
      .forEach(worker => {
        if (worker.state != WorkerState.Outdated) {
          worker.markAsOutdated();
        }
      });
  }

  private scaleWorkers() {
    const hasFreshWorker = Array.from(this.workers.values()).find(
      worker => worker.state == WorkerState.Fresh
    );

    if (hasFreshWorker) {
      return;
    }

    const id: string = uniqid();
    const node = this.runtimes.get("node") as Node;
    const worker = node.spawn({
      id,
      env: {
        __INTERNAL__SPICA__MONGOURL__: this.options.databaseUri,
        __INTERNAL__SPICA__MONGODBNAME__: this.options.databaseName,
        __INTERNAL__SPICA__MONGOREPL__: this.options.databaseReplicaSet,
        __INTERNAL__SPICA__PUBLIC_URL__: this.options.apiUrl,
        __EXPERIMENTAL_DEVKIT_DATABASE_CACHE: this.options.experimentalDevkitDatabaseCache
          ? "true"
          : "",
        LOGGER: this.options.logger ? "true" : undefined
      },
      entrypointPath: this.options.spawnEntrypointPath
    });

    worker.once("exit", () => this.lostWorker(id));

    this.workers.set(id, worker);

    // Initialize worker metrics
    this.workerMetrics.set(id, {
      spawnTime: Date.now(),
      lastUsed: Date.now(),
      executionCount: 0,
      averageResponseTime: 0
    });
  }

  /**
   * Start the auto-scaling system
   */
  private startAutoScaling() {
    if (!this.AUTO_SCALING_ENABLED) {
      return;
    }

    // Run scale down check every 30 seconds
    this.scaleDownTimer = setInterval(() => {
      this.evaluateScaleDown();
    }, 30000);
  }

  /**
   * Evaluate if we should scale up workers for better performance
   */
  private scaleUpIfNeeded(target: event.Target) {
    const now = Date.now();

    // Cooldown check
    if (now - this.loadMetrics.lastScaleAction < this.SCALE_COOLDOWN) {
      return;
    }

    const currentWorkers = Array.from(this.workers.values());
    const targetWorkers = currentWorkers.filter(w => w.hasSameTarget(target.id));
    const availableWorkers = targetWorkers.filter(
      w => w.state === WorkerState.Fresh || w.state === WorkerState.Targeted
    );

    // Check if we need more workers based on different criteria
    const queueUtilization = this.eventQueue.size / Math.max(currentWorkers.length, 1);
    const averageResponseTime = this.getAverageResponseTime();
    const maxWorkersReached = currentWorkers.length >= this.MAX_WORKERS;

    const shouldScaleUp =
      !maxWorkersReached &&
      // Scale up if queue utilization is high
      (queueUtilization > this.SCALE_UP_THRESHOLD ||
        // Scale up if no available workers and there are pending events
        (availableWorkers.length === 0 && this.eventQueue.size > 0) ||
        // Scale up if response time is above target
        (averageResponseTime > this.TARGET_RESPONSE_TIME && this.eventQueue.size > 0));

    if (shouldScaleUp) {
      this.print(
        `Scaling up: queue=${this.eventQueue.size}, workers=${currentWorkers.length}, utilization=${queueUtilization.toFixed(2)}, avgResponseTime=${averageResponseTime}ms`
      );
      this.spawnWorker();
      this.loadMetrics.lastScaleAction = now;
    }
  }

  /**
   * Evaluate if we should scale down workers to save resources
   */
  private evaluateScaleDown() {
    const now = Date.now();

    // Cooldown check
    if (now - this.loadMetrics.lastScaleAction < this.SCALE_COOLDOWN) {
      return;
    }

    const currentWorkers = Array.from(this.workers.entries());
    const idleWorkers = currentWorkers.filter(([id, worker]) => {
      const metrics = this.workerMetrics.get(id);
      return (
        metrics &&
        (worker.state === WorkerState.Fresh || worker.state === WorkerState.Targeted) &&
        now - metrics.lastUsed > this.WORKER_IDLE_TIMEOUT
      );
    });

    // Check if we should scale down
    const queueUtilization = this.eventQueue.size / Math.max(currentWorkers.length, 1);
    const minWorkersReached = currentWorkers.length <= this.MIN_WORKERS;

    const shouldScaleDown =
      !minWorkersReached &&
      // Scale down if we have idle workers and low queue utilization
      ((idleWorkers.length > 0 && queueUtilization < this.SCALE_DOWN_THRESHOLD) ||
        // Scale down if we have too many idle workers
        idleWorkers.length > 2);

    if (shouldScaleDown && idleWorkers.length > 0) {
      const [workerId, worker] = idleWorkers[0];
      this.print(
        `Scaling down: removing idle worker ${workerId}, idle for ${((now - this.workerMetrics.get(workerId)?.lastUsed) / 1000).toFixed(0)}s`
      );
      worker.kill();
      this.loadMetrics.lastScaleAction = now;
    }
  }

  /**
   * Spawn a new worker
   */
  private spawnWorker() {
    const id: string = uniqid();
    const node = this.runtimes.get("node") as Node;
    const worker = node.spawn({
      id,
      env: {
        __INTERNAL__SPICA__MONGOURL__: this.options.databaseUri,
        __INTERNAL__SPICA__MONGODBNAME__: this.options.databaseName,
        __INTERNAL__SPICA__MONGOREPL__: this.options.databaseReplicaSet,
        __INTERNAL__SPICA__PUBLIC_URL__: this.options.apiUrl,
        __EXPERIMENTAL_DEVKIT_DATABASE_CACHE: this.options.experimentalDevkitDatabaseCache
          ? "true"
          : "",
        LOGGER: this.options.logger ? "true" : undefined
      },
      entrypointPath: this.options.spawnEntrypointPath
    });

    worker.once("exit", () => this.lostWorker(id));

    this.workers.set(id, worker);

    // Initialize worker metrics
    this.workerMetrics.set(id, {
      spawnTime: Date.now(),
      lastUsed: Date.now(),
      executionCount: 0,
      averageResponseTime: 0
    });

    this.print(`Spawned new worker ${id}, total workers: ${this.workers.size}`);
  }

  /**
   * Update worker metrics when used
   */
  private updateWorkerMetrics(workerId: string, startTime: number) {
    const metrics = this.workerMetrics.get(workerId);
    if (metrics) {
      metrics.lastUsed = Date.now();
      metrics.executionCount++;

      // Update average response time (simple moving average)
      const responseTime = Date.now() - startTime;
      metrics.averageResponseTime =
        metrics.executionCount === 1
          ? responseTime
          : (metrics.averageResponseTime + responseTime) / 2;
    }
  }

  /**
   * Update global response time metrics
   */
  private updateResponseTimeMetrics(responseTime: number) {
    this.loadMetrics.responseTimeHistory.push(responseTime);

    // Keep only last N response times
    if (this.loadMetrics.responseTimeHistory.length > this.RESPONSE_TIME_WINDOW) {
      this.loadMetrics.responseTimeHistory.shift();
    }
  }

  /**
   * Get average response time from recent history
   */
  private getAverageResponseTime(): number {
    if (this.loadMetrics.responseTimeHistory.length === 0) {
      return 0;
    }

    const sum = this.loadMetrics.responseTimeHistory.reduce((a, b) => a + b, 0);
    return sum / this.loadMetrics.responseTimeHistory.length;
  }

  /**
   * ATTENTION: Do not use this method since it is only designed for testing.
   */
  kill() {
    this.queue.kill();
  }

  private print(message: string) {
    if (this.options.debug) {
      console.debug(message);
    }
  }
}
