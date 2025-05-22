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

    this.scaleWorkers();
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

    const fresh = workers.filter(w => w.state == WorkerState.Fresh).length;
    const activated = workers.length - fresh;

    return {
      activated: activated,
      fresh: fresh,
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
    for (const event of this.eventQueue.values()) {
      const workerMeta = this.takeAWorker(event.target);
      if (!workerMeta) {
        continue;
      }

      const {id: workerId, worker} = workerMeta;

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

      this.scaleWorkers();
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
