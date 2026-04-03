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
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {Scheduler} from "@spica-server/function/scheduler";
import {event} from "@spica-server/function/queue/proto";
import {JobReducer, ReplicationModule} from "@spica-server/replication";
import {BucketModule} from "@spica-server/bucket";
import {SecretModule} from "@spica-server/secret/src/module";

// Each test boots two full NestJS apps + MongoDB replica sets via Docker.
// Give hooks and individual tests plenty of room to breathe on CI.
const TEST_TIMEOUT_MS = 120_000;

function sleep(ms: number) {
  return new Promise((resolve, _) => setTimeout(resolve, ms));
}

/**
 * Returns a promise that resolves with the first event matching the supplied
 * criteria. The original `enqueue` is still called so the scheduler keeps
 * functioning normally. The listener is removed after the first match to
 * avoid resolving again on subsequent events.
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
        // Restore original so we don't re-resolve on subsequent events.
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

  let bucket;
  if (options?.createBucket) {
    bucket = await req
      .post("/bucket", {
        title: "Bucket1",
        description: "Bucket1",
        properties: {
          title: {
            type: "string"
          }
        }
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
  }, TEST_TIMEOUT_MS);

  afterEach(async () => {
    try {
      await Promise.all([app.close(), app2.close()]);
    } catch (error) {
      console.error(error);
    }
  }, TEST_TIMEOUT_MS);

  it(
    "should return 503 for events still in queue when app closes (HTTP events cannot be shifted)",
    async () => {
      // First request occupies the single worker for ~5 s.
      const firstResponsePromise = req.get("/fn-execute/test");

      // Wait until the worker has actually picked up the first request.
      await onEventEnqueued(scheduler, event.Type.HTTP);

      // Second request arrives while worker is occupied — it is queued.
      const secondResponsePromise = req.get("/fn-execute/test");

      // Confirm the second event is sitting in the queue.
      await onEventEnqueued(scheduler, event.Type.HTTP);

      // Close app1. HTTP events cannot be shifted to app2; the queued one
      // must end with a 503 error response.
      await app.close();

      const [firstResponse, secondResponse] = await Promise.all([
        firstResponsePromise,
        secondResponsePromise
      ]);

      // The queued second event was never executed — must be 503.
      expect([secondResponse.statusCode, secondResponse.statusText]).toEqual([
        503,
        "Service Unavailable"
      ]);

      // The in-flight first event either completed gracefully (200) or was
      // aborted during shutdown (503). Either is valid; no shift to app2 occurred.
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
  let fn;

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

    // Await to guarantee the trigger is active before the test body starts.
    await updateSchedulerTrigger(true);
  }, TEST_TIMEOUT_MS);

  afterEach(async () => {
    try {
      await Promise.all([app.close(), app2.close()]);
    } catch (error) {
      console.error(error);
    }
  }, TEST_TIMEOUT_MS);

  function updateSchedulerTrigger(active: boolean) {
    fn = JSON.parse(JSON.stringify(fn));
    fn.triggers.scheduler.active = active;
    return req.put(`/function/${fn._id}`, fn).then(res => res.body);
  }

  it(
    "should shift the event to the second replica when app closes",
    async () => {
      // Keep the worker busy so the schedule event is queued rather than executed.
      req.get("/fn-execute/test");
      await onEventEnqueued(scheduler, event.Type.HTTP);

      // Wait for the scheduler to fire while worker is occupied.
      const shiftedEvent = await onEventEnqueued(scheduler, event.Type.SCHEDULE);

      // Disable the trigger to avoid extra events firing during shutdown.
      await updateSchedulerTrigger(false);

      // Register the app2 listener BEFORE closing app1 so we cannot miss the shift.
      const event2Promise = onEventEnqueued(scheduler2, event.Type.SCHEDULE, shiftedEvent.id);

      // Closing app1 triggers the replication shift mechanism.
      await app.close();

      // The event received by app2 must be identical to the one queued on app1.
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
  }, TEST_TIMEOUT_MS);

  afterEach(async () => {
    try {
      await Promise.all([app.close(), app2.close()]);
    } catch (error) {
      console.error(error);
    }
  }, TEST_TIMEOUT_MS);

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
      // Keep the worker busy so the database event is queued.
      req.get("/fn-execute/test");
      await onEventEnqueued(scheduler, event.Type.HTTP);

      // Trigger a DB change; the event has no free worker and is queued.
      triggerDatabaseEvent();
      const shiftedEvent = await onEventEnqueued(scheduler, event.Type.DATABASE);

      // Register the app2 listener BEFORE closing app1 so we cannot miss the shift.
      const event2Promise = onEventEnqueued(scheduler2, event.Type.DATABASE, shiftedEvent.id);

      // Closing app1 triggers the replication shift mechanism.
      await app.close();

      // The event received by app2 must be identical to the one queued on app1.
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
  }, TEST_TIMEOUT_MS);

  afterEach(async () => {
    try {
      await Promise.all([app.close(), app2.close()]);
    } catch (error) {
      console.error(error);
    }
  }, TEST_TIMEOUT_MS);

  function triggerBucketDataEvent() {
    return req.post(`/bucket/${bucket._id}/data`, {title: "me"});
  }

  it(
    "should shift the event to the second replica when app closes",
    async () => {
      // Keep the worker busy so the bucket event is queued.
      req.get("/fn-execute/test");
      await onEventEnqueued(scheduler, event.Type.HTTP);

      // Insert a bucket document; the hook event has no free worker and is queued.
      triggerBucketDataEvent();
      const shiftedEvent = await onEventEnqueued(scheduler, event.Type.BUCKET);

      // Register the app2 listener BEFORE closing app1 so we cannot miss the shift.
      const event2Promise = onEventEnqueued(scheduler2, event.Type.BUCKET, shiftedEvent.id);

      // Closing app1 triggers the replication shift mechanism.
      await app.close();

      // The event received by app2 must be identical to the one queued on app1.
      const event2 = await event2Promise;
      expect(shiftedEvent).toEqual(event2);
    },
    TEST_TIMEOUT_MS
  );
});
