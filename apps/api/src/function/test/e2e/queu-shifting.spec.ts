import {Test, TestingModuleBuilder} from "@nestjs/testing";
import {FunctionModule} from "@spica-server/function";
import os from "os";
import {
  DatabaseService,
  DatabaseTestingModule,
  getConnectionUri,
  stream
} from "@spica-server/database/testing";
import {INestApplication} from "@nestjs/common";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {Scheduler} from "@spica-server/function/scheduler";
import {event} from "@spica-server/function/queue/proto";
import {JobReducer, ReplicationModule} from "@spica-server/replication";
import {BucketModule} from "@spica-server/bucket";
import {SecretModule} from "@spica-server/secret/src/module";

// Tests spin up two full NestJS apps + MongoDB replica sets; give them plenty of room on CI.
const TEST_TIMEOUT_MS = 120_000;

function sleep(ms: number) {
  return new Promise((resolve, _) => setTimeout(resolve, ms));
}

/**
 * Returns a promise that resolves with the first event that matches the supplied
 * criteria and is passed to `scheduler.enqueue`.  The original `enqueue` is still
 * called so the scheduler continues to operate normally.
 */
function onEventEnqueued(
  scheduler: Scheduler,
  eventType?: number,
  eventId?: string
): Promise<event.Event> {
  return new Promise(resolve => {
    const originalEnqueue = scheduler.enqueue;
    scheduler.enqueue = (...args) => {
      originalEnqueue.bind(scheduler)(...args);

      const typeMatches = eventType != null && args[0].type == eventType;
      const idMatches = eventId != null && args[0].id == eventId;

      if (eventType == null || (typeMatches && eventId == null) || (typeMatches && idMatches)) {
        // Restore original to avoid re-resolving on subsequent calls.
        scheduler.enqueue = originalEnqueue;
        resolve(args[0]);
      }
    };
  });
}

const FUNCTION_MODULE_OPTIONS = {
  invocationLogs: false,
  path: os.tmpdir(),
  databaseName: undefined,
  databaseReplicaSet: undefined,
  databaseUri: undefined,
  apiUrl: undefined,
  timeout: 10,
  corsOptions: {
    allowCredentials: true,
    allowedHeaders: ["*"],
    allowedMethods: ["*"],
    allowedOrigins: ["*"]
  },
  logExpireAfterSeconds: 60,
  entryLimit: 20,
  maxConcurrency: 1,
  debug: false,
  realtimeLogs: false,
  logger: false,
  spawnEntrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH,
  tsCompilerPath: process.env.FUNCTION_TS_COMPILER_PATH,
  realtime: false
};

function getModuleBuilder(
  connectionUri?: string,
  dbName?: string,
  options?: {includeBucketModule?: boolean}
): TestingModuleBuilder {
  const imports: any[] = [
    CoreTestingModule,
    connectionUri
      ? DatabaseTestingModule.connect(connectionUri, dbName)
      : DatabaseTestingModule.replicaSet(),
    PreferenceTestingModule,
    PassportTestingModule.initialize({overriddenStrategyType: "JWT"}),
    SchemaModule.forRoot({
      formats: options?.includeBucketModule ? [OBJECT_ID, OBJECTID_STRING] : [OBJECT_ID]
    }),
    SecretModule.forRoot({realtime: false, encryptionSecret: "test-encryption-secret-32chars!!"}),
    FunctionModule.forRoot(FUNCTION_MODULE_OPTIONS),
    ReplicationModule.forRoot()
  ];

  if (options?.includeBucketModule) {
    imports.push(
      BucketModule.forRoot({
        cache: false,
        graphql: false,
        history: false,
        hooks: true,
        realtime: false
      })
    );
  }

  return Test.createTestingModule({imports});
}

interface StartAppResult {
  app: INestApplication;
  app2: INestApplication;
  req: Request;
  scheduler: Scheduler;
  scheduler2: Scheduler;
  db: DatabaseService;
  fn: any;
  bucket?: any;
}

async function startApp(
  grpcAddresses: string[],
  triggers: Record<string, any>,
  fnIndex: string,
  options?: {includeBucketModule?: boolean; createBucket?: boolean}
): Promise<StartAppResult> {
  const module = await getModuleBuilder(undefined, undefined, options).compile();
  const db = module.get(DatabaseService);
  await db.collection("my_coll").insertOne({test: "123"});

  const connectionUri = getConnectionUri();
  const module2 = await getModuleBuilder(connectionUri, db.databaseName, options).compile();

  // Introduce a tiny delay in the second replica's job reducer to ensure the
  // first replica has had time to register the shift before the second picks it up.
  const secondRepReducer = module2.get(JobReducer);
  const copyDo = secondRepReducer.do;
  secondRepReducer.do = async (...args) => {
    await sleep(1);
    return copyDo.bind(secondRepReducer)(...args);
  };

  module.enableShutdownHooks();
  module2.enableShutdownHooks();

  process.env.FUNCTION_GRPC_ADDRESS = grpcAddresses[0];
  const app = await module.createNestApplication().init();

  process.env.FUNCTION_GRPC_ADDRESS = grpcAddresses[1];
  const app2 = await module2.createNestApplication().init();

  const scheduler = module.get(Scheduler);
  const scheduler2 = module2.get(Scheduler);

  const req = module.get(Request);
  await app.listen(req.socket);

  let bucket: any;
  if (options?.createBucket) {
    bucket = await req
      .post("/bucket", {
        title: "Bucket1",
        description: "Bucket1",
        properties: {title: {type: "string"}}
      })
      .then(r => r.body);

    triggers.bucket.options.bucket = bucket._id;
  }

  const fn = await req
    .post("/function", {
      name: "test",
      description: "test",
      language: "javascript",
      timeout: 10,
      triggers,
      memoryLimit: 100
    })
    .then(res => res.body);

  await req.post(`/function/${fn._id}/index`, {index: fnIndex});

  return {app, app2, req, scheduler, scheduler2, db, fn, bucket};
}

// ─── HTTP Queue Shifting ────────────────────────────────────────────────────────
//
// HTTP events are tied to an open connection and cannot be shifted to another
// replica when the owning app shuts down.  Events that are still queued (worker
// was busy) must respond with 503.

describe("Queue shifting - HTTP", () => {
  let app: INestApplication;
  let app2: INestApplication;
  let req: Request;
  let scheduler: Scheduler;

  beforeEach(async () => {
    const res = await startApp(
      ["0.0.0.0:38747", "0.0.0.0:34953"],
      {
        http: {
          options: {method: "Get", path: "/test", preflight: true},
          type: "http",
          active: true
        }
      },
      `export async function http(req,res){
          await new Promise((resolve,reject) => setTimeout(resolve,5000));
          return res.status(200).send("OK")
        }
        `
    );
    app = res.app;
    app2 = res.app2;
    req = res.req;
    scheduler = res.scheduler;
  });

  afterEach(async () => {
    try {
      await Promise.all([app.close(), app2.close()]);
    } catch (error) {
      console.error(error);
    }
  });

  it(
    "should return 503 for events still in queue when app closes (HTTP events cannot be shifted)",
    async () => {
      // Send the first request — this keeps the single worker busy for ~5 s.
      const firstResponsePromise = req.get("/fn-execute/test");

      // Wait until the worker has actually picked it up.
      await onEventEnqueued(scheduler, event.Type.HTTP);

      // Send the second request — it will be queued because the worker is occupied.
      const secondResponsePromise = req.get("/fn-execute/test");

      // Wait until the second event is confirmed in the queue.
      await onEventEnqueued(scheduler, event.Type.HTTP);

      // Close app1.  The queued HTTP event cannot be shifted to app2 because an
      // HTTP trigger is bound to the originating connection.  It must get 503.
      await app.close();

      // Both promises must settle now that the server is closed.
      const [firstResponse, secondResponse] = await Promise.all([
        firstResponsePromise,
        secondResponsePromise
      ]);

      // The queued (second) event was never executed — it must be 503.
      expect([secondResponse.statusCode, secondResponse.statusText]).toEqual([
        503,
        "Service Unavailable"
      ]);

      // The in-flight (first) event either completed before close (200) or was
      // aborted during shutdown (503).  Either is acceptable; what matters is
      // that no event was silently dropped and no shift to app2 occurred.
      expect([200, 503]).toContain(firstResponse.statusCode);
    },
    TEST_TIMEOUT_MS
  );
});

// ─── Schedule Queue Shifting ────────────────────────────────────────────────────

describe("Queue shifting - Schedule", () => {
  let app: INestApplication;
  let app2: INestApplication;
  let req: Request;
  let scheduler: Scheduler;
  let scheduler2: Scheduler;
  let fn: any;

  beforeEach(async () => {
    const res = await startApp(
      ["0.0.0.0:38748", "0.0.0.0:34954"],
      {
        http: {
          options: {method: "Get", path: "/test", preflight: true},
          type: "http",
          active: true
        },
        scheduler: {
          options: {timezone: "UTC", frequency: "* * * * * *"},
          type: "schedule",
          active: false
        }
      },
      `export async function http(req,res){
          await new Promise((resolve,reject) => setTimeout(resolve,5000));
          return res.status(200).send("OK")
        }
        export function scheduler(){
          return "OK";
        }
        `
    );
    app = res.app;
    app2 = res.app2;
    req = res.req;
    scheduler = res.scheduler;
    scheduler2 = res.scheduler2;
    fn = res.fn;

    // Must be awaited — the test depends on the trigger being active before it starts.
    await updateSchedulerTrigger(true);
  });

  afterEach(async () => {
    try {
      await Promise.all([app.close(), app2.close()]);
    } catch (error) {
      console.error(error);
    }
  });

  function updateSchedulerTrigger(active: boolean) {
    fn = JSON.parse(JSON.stringify(fn));
    fn.triggers.scheduler.active = active;
    return req.put(`/function/${fn._id}`, fn).then(res => res.body);
  }

  it(
    "should shift the event to the second replica when app closes",
    async () => {
      // Keep the worker busy so the next schedule event is queued rather than processed.
      req.get("/fn-execute/test");
      await onEventEnqueued(scheduler, event.Type.HTTP);

      // Wait for the schedule trigger to fire while worker is occupied.
      const shiftedEvent = await onEventEnqueued(scheduler, event.Type.SCHEDULE);

      // Disable the trigger immediately to prevent extra events from firing.
      await updateSchedulerTrigger(false);

      // Register the app2 listener BEFORE closing app1 so we don't miss the shift.
      const event2Promise = onEventEnqueued(scheduler2, event.Type.SCHEDULE, shiftedEvent.id);

      // Closing app1 triggers the replication shift to app2.
      await app.close();

      // The shifted event must be identical when received by app2.
      const event2 = await event2Promise;
      expect(shiftedEvent).toEqual(event2);
    },
    TEST_TIMEOUT_MS
  );
});

// ─── Database Queue Shifting ────────────────────────────────────────────────────

describe("Queue shifting - Database", () => {
  let app: INestApplication;
  let app2: INestApplication;
  let req: Request;
  let scheduler: Scheduler;
  let scheduler2: Scheduler;
  let db: DatabaseService;

  beforeEach(async () => {
    const res = await startApp(
      ["0.0.0.0:38749", "0.0.0.0:34955"],
      {
        http: {
          options: {method: "Get", path: "/test", preflight: true},
          type: "http",
          active: true
        },
        database: {
          options: {collection: "my_coll", type: "INSERT"},
          type: "database",
          active: true
        }
      },
      `export async function http(req,res){
          await new Promise((resolve,reject) => setTimeout(resolve,5000));
          return res.status(200).send("OK")
        }

        export function database(change){
          return "OK";
        }
        `
    );
    app = res.app;
    app2 = res.app2;
    req = res.req;
    scheduler = res.scheduler;
    scheduler2 = res.scheduler2;
    db = res.db;
  });

  afterEach(async () => {
    try {
      await Promise.all([app.close(), app2.close()]);
    } catch (error) {
      console.error(error);
    }
  });

  async function triggerDatabaseEvent() {
    return new Promise((resolve, reject) => {
      stream.change.next();
      stream.change.wait().then(() => resolve(""));
      db.collection("my_coll").insertOne({test: "asdqwe"});
    });
  }

  it(
    "should shift the event to the second replica when app closes",
    async () => {
      // Keep the worker busy so the database event ends up in the queue.
      req.get("/fn-execute/test");
      await onEventEnqueued(scheduler, event.Type.HTTP);

      // Trigger a database change; the event will be queued behind the HTTP event.
      triggerDatabaseEvent();
      const shiftedEvent = await onEventEnqueued(scheduler, event.Type.DATABASE);

      // Register the app2 listener BEFORE closing app1 so we don't miss the shift.
      const event2Promise = onEventEnqueued(scheduler2, event.Type.DATABASE, shiftedEvent.id);

      // Closing app1 triggers the replication shift to app2.
      await app.close();

      // The shifted event must be identical when received by app2.
      const event2 = await event2Promise;
      expect(shiftedEvent).toEqual(event2);
    },
    TEST_TIMEOUT_MS
  );
});

// ─── Bucket Queue Shifting ──────────────────────────────────────────────────────

describe("Queue shifting - Bucket", () => {
  let app: INestApplication;
  let app2: INestApplication;
  let req: Request;
  let scheduler: Scheduler;
  let scheduler2: Scheduler;
  let bucket: any;

  beforeEach(async () => {
    const res = await startApp(
      ["0.0.0.0:38750", "0.0.0.0:34956"],
      {
        http: {
          options: {method: "Get", path: "/test", preflight: true},
          type: "http",
          active: true
        },
        bucket: {
          options: {bucket: "", type: "INSERT"},
          type: "bucket",
          active: true
        }
      },
      `export async function http(req,res){
          await new Promise((resolve,reject) => setTimeout(resolve,5000));
          return res.status(200).send("OK")
        }

        export function bucket(change){
          return "OK";
        }
        `,
      {includeBucketModule: true, createBucket: true}
    );
    app = res.app;
    app2 = res.app2;
    req = res.req;
    scheduler = res.scheduler;
    scheduler2 = res.scheduler2;
    bucket = res.bucket;
  });

  afterEach(async () => {
    try {
      await Promise.all([app.close(), app2.close()]);
    } catch (error) {
      console.error(error);
    }
  });

  function triggerBucketDataEvent() {
    return req.post(`/bucket/${bucket._id}/data`, {title: "me"});
  }

  it(
    "should shift the event to the second replica when app closes",
    async () => {
      // Keep the worker busy so the bucket event ends up in the queue.
      req.get("/fn-execute/test");
      await onEventEnqueued(scheduler, event.Type.HTTP);

      // Insert a bucket document; the hook event will be queued.
      triggerBucketDataEvent();
      const shiftedEvent = await onEventEnqueued(scheduler, event.Type.BUCKET);

      // Register the app2 listener BEFORE closing app1 so we don't miss the shift.
      const event2Promise = onEventEnqueued(scheduler2, event.Type.BUCKET, shiftedEvent.id);

      // Closing app1 triggers the replication shift to app2.
      await app.close();

      // The shifted event must be identical when received by app2.
      const event2 = await event2Promise;
      expect(shiftedEvent).toEqual(event2);
    },
    TEST_TIMEOUT_MS
  );
});
