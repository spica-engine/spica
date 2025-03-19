import {Test} from "@nestjs/testing";
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

function sleep(ms: number) {
  return new Promise((resolve, _) => setTimeout(resolve, ms));
}
describe("Queue shifting", () => {
  let fn;
  let bucket;

  function onEventEnqueued(
    scheduler: Scheduler,
    eventType?: number,
    eventId?: string
  ): Promise<event.Event> {
    return new Promise((resolve, reject) => {
      const enqueue = scheduler.enqueue;
      scheduler.enqueue = (...args) => {
        enqueue.bind(scheduler)(...args);
        const areEventTypesMatched = eventType && args[0].type == eventType;
        const areEventIdsMatched = eventId && args[0].id == eventId;
        if (
          !eventType ||
          (areEventTypesMatched && !eventId) ||
          (areEventTypesMatched && areEventIdsMatched)
        ) {
          resolve(args[0]);
        }
      };
    });
  }

  function getModuleBuilder(connectionUri?: string) {
    return Test.createTestingModule({
      imports: [
        CoreTestingModule,
        connectionUri
          ? DatabaseTestingModule.connect(connectionUri)
          : DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        PassportTestingModule.initialize({overriddenStrategyType: "JWT"}),
        SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
        FunctionModule.forRoot({
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
          tsCompilerPath: process.env.FUNCTION_TS_COMPILER_PATH
        }),
        ReplicationModule.forRoot(),
        BucketModule.forRoot({
          cache: false,
          graphql: false,
          history: false,
          hooks: true,
          realtime: false
        })
      ]
    });
  }
  async function startApp(grpcaddresses: string[]) {
    const module = await getModuleBuilder().compile();
    const db = module.get(DatabaseService);
    await db.collection("my_coll").insertOne({test: "123"});

    const connectionUri = getConnectionUri();
    const module2 = await getModuleBuilder(connectionUri).compile();

    // put a bit delay to let first replica takes jobs before second replica.
    // because we assume that first replica shifts jobs to the second replica for all test cases
    const secondRepReducer = module2.get(JobReducer);
    const copyDo = secondRepReducer.do;
    secondRepReducer.do = async (...args) => {
      await sleep(1);
      return copyDo.bind(secondRepReducer)(...args);
    };

    module.enableShutdownHooks();
    module2.enableShutdownHooks();

    process.env.FUNCTION_GRPC_ADDRESS = grpcaddresses[0];
    // "0.0.0.0:38747";
    const app = await module.createNestApplication().init();

    process.env.FUNCTION_GRPC_ADDRESS = grpcaddresses[1];
    // "0.0.0.0:34953";
    const app2 = await module2.createNestApplication().init();

    const scheduler = module.get(Scheduler);
    const scheduler2 = module2.get(Scheduler);

    const req = module.get(Request);
    await app.listen(req.socket);

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

    fn = await req
      .post("/function", {
        name: "test",
        description: "test",
        language: "javascript",
        timeout: 10,
        triggers: {
          http: {
            options: {
              method: "Get",
              path: "/test",
              preflight: true
            },
            type: "http",
            active: true
          },
          scheduler: {
            options: {
              timezone: "UTC",
              frequency: "* * * * * *"
            },
            type: "schedule",
            active: false
          },
          database: {
            options: {
              collection: "my_coll",
              type: "INSERT"
            },
            type: "database",
            active: true
          },
          bucket: {
            options: {
              bucket: bucket._id,
              type: "INSERT"
            },
            type: "bucket",
            active: true
          }
        },
        env: {},
        memoryLimit: 100
      })
      .then(res => res.body);

    await req.post(`/function/${fn._id}/index`, {
      index: `export async function http(req,res){
            await new Promise((resolve,reject) => setTimeout(resolve,5000));
            return res.status(200).send("OK")
          }
  
          export function bucket(change){
            return "OK";
          }
          
          export function database(change){
            return "OK";
          }
  
          export function scheduler(){
            return "OK";
          }
          `
    });

    await sleep(5000);

    return {
      app,
      app2,
      req,
      scheduler,
      scheduler2,
      db,
      fn,
      bucket
    };
  }

  describe("http", () => {
    let app: INestApplication;
    let app2: INestApplication;
    let req: Request;
    let scheduler: Scheduler;

    beforeEach(async () => {
      const res = await startApp(["0.0.0.0:38747", "0.0.0.0:34953"]);
      app = res.app;
      app2 = res.app2;
      req = res.req;
      scheduler = res.scheduler;
    });

    afterEach(async () => await app2.close());

    it("should wait until current event completed, return 503 for ones in queue", done => {
      let firstResponse;
      let secondResponse;

      onEventEnqueued(scheduler, event.Type.HTTP).then(() => {
        onEventEnqueued(scheduler, event.Type.HTTP).then(() => {
          app.close().then(() => {
            expect([firstResponse.statusCode, firstResponse.statusText]).toEqual([200, "OK"]);
            expect([secondResponse.statusCode, secondResponse.statusText]).toEqual([
              503,
              "Service Unavailable"
            ]);
            done();
          });
        });
        req.get("/fn-execute/test").then(r => (secondResponse = r));
      });

      req.get("/fn-execute/test").then(r => (firstResponse = r));
    });
  });

  describe("schedule", () => {
    let app: INestApplication;
    let app2: INestApplication;
    let req: Request;
    let scheduler: Scheduler;
    let scheduler2: Scheduler;

    beforeEach(async () => {
      const res = await startApp(["0.0.0.0:38748", "0.0.0.0:34954"]);
      app = res.app;
      app2 = res.app2;
      req = res.req;
      scheduler = res.scheduler;
      scheduler2 = res.scheduler2;

      updateSchedulerTrigger(true);
    });

    afterEach(async () => await app2.close());

    // don't know but somehow scheduler trigger prevents API from exiting on the exit signal received If it runs every second
    // that's why we had to disable the trigger after the event shifted
    // it does not valid for the production
    function updateSchedulerTrigger(active: boolean) {
      fn = JSON.parse(JSON.stringify(fn));
      fn.triggers.scheduler.active = active;

      return req.put(`/function/${fn._id}`, fn).then(res => res.body);
    }

    it("should shift the event", done => {
      let event1;
      let event2;

      onEventEnqueued(scheduler, event.Type.HTTP).then(() => {
        onEventEnqueued(scheduler, event.Type.SCHEDULE).then(shiftedEvent => {
          updateSchedulerTrigger(false);

          event1 = shiftedEvent;
          onEventEnqueued(scheduler2, event.Type.SCHEDULE, shiftedEvent.id).then(enqueuedEvent => {
            event2 = enqueuedEvent;
          });

          app.close().then(() => {
            expect(event1).toEqual(event2);
            done();
          });
        });
      });

      req.get("/fn-execute/test");
    });
  });

  describe("database", () => {
    let app: INestApplication;
    let app2: INestApplication;
    let req: Request;
    let scheduler: Scheduler;
    let scheduler2: Scheduler;
    let db: DatabaseService;

    beforeEach(async () => {
      const res = await startApp(["0.0.0.0:38749", "0.0.0.0:34955"]);
      app = res.app;
      app2 = res.app2;
      req = res.req;
      scheduler = res.scheduler;
      scheduler2 = res.scheduler2;
      db = res.db;
    });

    afterEach(async () => await app2.close());

    async function triggerDatabaseEvent() {
      return new Promise((resolve, reject) => {
        stream.change.next();
        stream.change.wait().then(() => resolve(""));
        db.collection("my_coll").insertOne({test: "asdqwe"});
      });
    }

    it("should shift the event", done => {
      let event1;
      let event2;

      onEventEnqueued(scheduler, event.Type.HTTP).then(() => {
        onEventEnqueued(scheduler, event.Type.DATABASE).then(shiftedEvent => {
          event1 = shiftedEvent;
          onEventEnqueued(scheduler2, event.Type.DATABASE).then(enqueuedEvent => {
            event2 = enqueuedEvent;
          });

          app.close().then(() => {
            expect(event1).toEqual(event2);
            done();
          });
        });

        triggerDatabaseEvent();
      });

      req.get("/fn-execute/test");
    });
  });

  describe("bucket", () => {
    let app: INestApplication;
    let app2: INestApplication;
    let req: Request;
    let scheduler: Scheduler;
    let scheduler2: Scheduler;
    let db: DatabaseService;
    let bucket;

    beforeEach(async () => {
      const res = await startApp(["0.0.0.0:38750", "0.0.0.0:34956"]);
      app = res.app;
      app2 = res.app2;
      req = res.req;
      scheduler = res.scheduler;
      scheduler2 = res.scheduler2;
      db = res.db;
      bucket = res.bucket;
    });

    afterEach(async () => await app2.close());

    function triggerBucketDataEvent() {
      return req.post(`/bucket/${bucket._id}/data`, {
        title: "me"
      });
    }

    it("should shift the event", done => {
      let event1;
      let event2;

      onEventEnqueued(scheduler, event.Type.HTTP).then(() => {
        onEventEnqueued(scheduler, event.Type.BUCKET).then(shiftedEvent => {
          event1 = shiftedEvent;
          onEventEnqueued(scheduler2, event.Type.BUCKET).then(enqueuedEvent => {
            event2 = enqueuedEvent;
          });

          app.close().then(() => {
            expect(event1).toEqual(event2);
            done();
          });
        });

        triggerBucketDataEvent();
      });

      req.get("/fn-execute/test");
    });
  });
});
