import {Test, TestingModule} from "@nestjs/testing";
import {FunctionModule} from "@spica-server/function";
import * as os from "os";
import {DatabaseService, DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {INestApplication} from "@nestjs/common";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {Scheduler} from "@spica-server/function/scheduler";
import {event} from "@spica-server/function/queue/proto";
import {JobReducer, ReplicationModule} from "@spica-server/replication";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 15_000;

function sleep(ms: number) {
  return new Promise((resolve, _) => setTimeout(resolve, ms));
}

describe("Queue shifting", () => {
  let module: TestingModule;
  let app: INestApplication;
  let app2: INestApplication;
  let req: Request;
  let scheduler: Scheduler;
  let scheduler2: Scheduler;
  let db: DatabaseService;
  let fn;

  function getModuleBuilder(dbName?: string) {
    return Test.createTestingModule({
      imports: [
        CoreTestingModule,
        DatabaseTestingModule.replicaSet(dbName),
        PreferenceTestingModule,
        PassportTestingModule.initialize({overriddenStrategyType: "JWT"}),
        SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
        FunctionModule.forRoot({
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
          logger: false
        }),
        ReplicationModule.forRoot()
      ]
    });
  }

  beforeEach(async () => {
    module = await getModuleBuilder().compile();

    db = module.get(DatabaseService);
    await db.collection("my_coll").insertOne({test: "123"});

    const module2 = await getModuleBuilder(db.databaseName).compile();

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

    app = module.createNestApplication();

    process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:38747";
    app = await module.createNestApplication().init();

    process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:34953";
    app2 = await module2.createNestApplication().init();

    scheduler = module.get(Scheduler);
    scheduler2 = module2.get(Scheduler);

    req = module.get(Request);
    await app.listen(req.socket);

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
            active: true
          },
          database: {
            options: {
              collection: "my_coll",
              type: "INSERT"
            },
            type: "database",
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
        
        export function database(change){
          return "OK";
        }

        export function scheduler(){
          return "OK";
        }
        `
    });

    await sleep(3000);

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__skip__") {
        return true;
      }
    });
  });

  afterEach(async () => {
    await app.close();
    await app2.close();
  });

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

  describe("http", () => {
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
    it("should shift the event", done => {
      let event1;
      let event2;

      onEventEnqueued(scheduler, event.Type.HTTP).then(() => {
        onEventEnqueued(scheduler, event.Type.SCHEDULE).then(shiftedEvent => {
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

  async function triggerDatabaseEvent() {
    stream.change.next();
    await db
      .collection("my_coll")
      .insertOne({test: "asdqwe"})
      .then(r => r.ops[0]);
    await stream.change.wait();
  }

  describe("database", () => {
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
});
