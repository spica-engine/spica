import {Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional} from "@nestjs/common";
import {APP_INTERCEPTOR, HttpAdapterHost} from "@nestjs/core";
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
  SystemEnqueuer
} from "@spica-server/function/enqueuer";
import {PackageManager} from "@spica-server/function/pkgmanager";
import {Npm} from "@spica-server/function/pkgmanager/node";
import {DatabaseQueue, EventQueue, FirehoseQueue, HttpQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import {Runtime, Worker} from "@spica-server/function/runtime";
import {DatabaseOutput, StandartStream} from "@spica-server/function/runtime/io";
import {generateLog, LogLevels} from "@spica-server/function/runtime/logger";
import {Node} from "@spica-server/function/runtime/node";
import {ClassCommander, CommandType, JobReducer} from "@spica-server/replication";
import {
  AttachHttpCounter,
  ATTACH_HTTP_COUNTER,
  ATTACH_INVOCATION_COUNTER,
  AttachInvocationCounter
} from "@spica-server/status/services";
import * as uniqid from "uniqid";
import {ENQUEUER, EnqueuerFactory} from "./enqueuer";
import {SchedulingOptions, SCHEDULING_OPTIONS} from "./options";
import {Subject} from "rxjs";
import {take} from "rxjs/operators";

type ScheduleWorker = Worker & {
  target: event.Target;
  schedule: (event: event.Event) => void;
  isOutdated?: boolean;
};

@Injectable()
export class Scheduler implements OnModuleInit, OnModuleDestroy {
  private queue: EventQueue;
  private httpQueue: HttpQueue;
  private databaseQueue: DatabaseQueue;
  private firehoseQueue: FirehoseQueue;

  readonly runtimes = new Map<string, Runtime>();
  readonly pkgmanagers = new Map<string, PackageManager>();
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
    @Optional() @Inject(ATTACH_HTTP_COUNTER) private attachHttpCounter: AttachHttpCounter,
    @Optional()
    @Inject(ATTACH_INVOCATION_COUNTER)
    private attachInvocationCounter: AttachInvocationCounter
  ) {
    if (this.commander) {
      this.commander.register(this, [this.outdateWorkers], CommandType.SYNC);
    }

    this.output = new DatabaseOutput(database);

    this.languages.set("typescript", new Typescript());
    this.languages.set("javascript", new Javascript());
    this.runtimes.set("node", new Node());
    this.pkgmanagers.set("node", new Npm());

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
        this.attachHttpCounter
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

    if (typeof this.enqueuerFactory == "function") {
      const factory = this.enqueuerFactory(this.queue, this.jobReducer, this.commander);
      this.queue.addQueue(factory.queue);
      this.enqueuers.add(factory.enqueuer);
    }

    await this.queue.listen();

    this.scaleWorkers();
  }

  killFreeWorkers() {
    const isFresh = worker => !worker.target;
    const isWaitingForNextEvent = worker => worker.target && worker.schedule;

    const freeWorkers = Array.from(this.workers.entries()).filter(
      ([key, worker]) => isFresh(worker) || isWaitingForNextEvent(worker)
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
      : this.onLastWorkerLost
          .asObservable()
          .pipe(take(1))
          .toPromise();
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

    const activated = workers.filter(w => w.target).length;
    const fresh = workers.length - activated;

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

    const fresh = workers.find(({worker}) => !worker.target);
    const activateds = workers.filter(({worker}) => worker.target && worker.target.id == target.id);

    const available = activateds.find(({worker}) => worker.schedule);

    if (activateds.length == this.options.maxConcurrency) {
      return available || {id: undefined, worker: {} as any};
    }

    return available || fresh;
  }

  process() {
    for (const event of this.eventQueue.values()) {
      const {id: workerId, worker} = this.takeAWorker(event.target);
      // if worker is busy, move to the next events
      if (!worker.schedule) {
        continue;
      }

      const schedule = worker.schedule;
      worker.schedule = undefined;
      worker.target = event.target;

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
        if (channel.writable) {
          channel.write(timeoutMsg);
        }
        worker.kill();
      };

      if (this.timeouts.has(workerId)) {
        clearTimeout(this.timeouts.get(workerId));
      }
      this.timeouts.set(workerId, setTimeout(timeoutFn, timeoutInMs));

      schedule(event);

      this.eventQueue.delete(event.id);

      this.print(`assigning ${event.id} to ${workerId}`);

      this.scaleWorkers();
    }
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

    if (!relatedWorker || relatedWorker.isOutdated) {
      this.print(`the worker ${id} won't be scheduled anymore.`);
    } else {
      relatedWorker.schedule = schedule;

      if (this.attachInvocationCounter) {
        this.handleInvocationCounter(relatedWorker);
      }

      this.print(
        relatedWorker.target ? `worker ${id} is waiting for new event` : `got a new worker ${id}`
      );
    }

    this.process();
  }

  handleInvocationCounter(worker: ScheduleWorker) {
    const statusBuilder = (...args) => {
      const ev: event.Event = args[0];
      return {
        context: ev.target.id,
        method: ev.target.handler,
        module: "function",
        details: {
          type: event.Type[ev.type]
        }
      };
    };
    this.attachInvocationCounter(worker, "schedule", statusBuilder);
  }

  lostWorker(id: string) {
    this.workers.delete(id);

    clearTimeout(this.timeouts.get(id));
    this.timeouts.delete(id);

    this.print(`lost a worker ${id}`);

    if (!this.workers.size) {
      this.onLastWorkerLost.next();
    }
  }

  outdateWorkers(targetId: string) {
    Array.from(this.workers.values())
      .filter(worker => worker.target && worker.target.id == targetId)
      .forEach(worker => (worker.isOutdated = true));
  }

  private scaleWorkers() {
    const activatedWorkers = Array.from(this.workers.values()).filter(w => w.target).length;
    const desiredWorkers = activatedWorkers + 1;

    for (let i = this.workers.size; i < desiredWorkers; i++) {
      const id: string = uniqid();
      const worker = this.runtimes.get("node").spawn({
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
        }
      });

      worker.once("exit", () => this.lostWorker(id));

      (worker as ScheduleWorker).schedule = undefined;
      (worker as ScheduleWorker).target = undefined;

      this.workers.set(id, worker as ScheduleWorker);
    }
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
