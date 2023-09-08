import {Test, TestingModule} from "@nestjs/testing";
import {FunctionModule} from "@spica-server/function";
import {FunctionEngine} from "@spica-server/function/src/engine";
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
import {CommandMessenger, REPLICA_ID, ReplicationModule} from "@spica-server/replication";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:38747";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 15_000;

function sleep(ms: number) {
  return new Promise((resolve, _) => setTimeout(resolve, ms));
}

describe("Queue shifting", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let scheduler: Scheduler;
  let db: DatabaseService;
  let fn;

  function getModuleBuilder() {
    return Test.createTestingModule({
      imports: [
        CoreTestingModule,
        DatabaseTestingModule.replicaSet(),
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
    module.enableShutdownHooks();

    scheduler = module.get(Scheduler);
    db = module.get(DatabaseService);
    await db.collection("my_coll").insertOne({test: "123"});

    app = module.createNestApplication();

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

  afterEach(() => {
    app.close();
  });

  function onEventEnqueued(scheduler: Scheduler, eventType?: number): Promise<event.Event> {
    return new Promise((resolve, reject) => {
      const enqueue = scheduler.enqueue;
      scheduler.enqueue = (...args) => {
        enqueue.bind(scheduler)(...args);
        if (!eventType || (eventType && args[0].type == eventType)) {
          resolve(args[0]);
        }
      };
    });
  }

  describe("http", () => {
    it("should wait until current event completed, return 503 for ones in queue", async () => {
      let firstResponse;
      let secondResponse;

      req.get("/fn-execute/test").then(r => (firstResponse = r));

      await onEventEnqueued(scheduler, event.Type.HTTP);
      req.get("/fn-execute/test").then(r => (secondResponse = r));

      await onEventEnqueued(scheduler, event.Type.HTTP);
      await app.close();

      expect([firstResponse.statusCode, firstResponse.statusText]).toEqual([200, "OK"]);
      expect([secondResponse.statusCode, secondResponse.statusText]).toEqual([
        503,
        "Service Unavailable"
      ]);
    });
  });

  describe("schedule", () => {
    it("should shift the event", async () => {
      req.get("/fn-execute/test");
      await onEventEnqueued(scheduler, event.Type.HTTP);

      const shiftedEvent = await onEventEnqueued(scheduler, event.Type.SCHEDULE);

      await app.close();

      // here is so dependent to the commander implementation, use better approach
      const shiftCmd = await db
        .collection("commands")
        .find({
          "source.command.class": "ScheduleEnqueuer"
        })
        .toArray();

      expect(shiftCmd).toEqual([
        {
          _id: "__skip__",
          source: {
            command: {
              class: "ScheduleEnqueuer",
              handler: "copy_shift",
              args: [shiftedEvent.target.toObject(), {frequency: "* * * * * *", timezone: "UTC"}]
            },
            id: module.get(REPLICA_ID)
          },
          target: {
            commands: [
              {
                class: "ScheduleEnqueuer",
                handler: "copy_shift",
                args: [shiftedEvent.target.toObject(), {frequency: "* * * * * *", timezone: "UTC"}]
              }
            ]
          }
        }
      ]);
    });
  });

  describe("database", () => {
    it("should shift the event", async () => {
      req.get("/fn-execute/test");
      await onEventEnqueued(scheduler, event.Type.HTTP);

      let shiftedEvent;
      onEventEnqueued(scheduler, event.Type.DATABASE).then(e => (shiftedEvent = e));

      stream.change.next();
      const inserted = await db
        .collection("my_coll")
        .insertOne({test: "asdqwe"})
        .then(r => r.ops[0]);
      await stream.change.wait();

      await app.close();

      // here is so dependent to the commander implementation, use better approach
      const shiftCmd = await db
        .collection("commands")
        .find({
          "source.command.class": "DatabaseEnqueuer"
        })
        .toArray();

      const change = {
        _id: {_data: "__skip__"},
        clusterTime: "__skip__",
        documentKey: {_id: inserted._id},
        fullDocument: inserted,
        ns: {db: "__skip__", coll: "my_coll"},
        operationType: "insert",
        event_id: shiftedEvent.id
      };
      expect(shiftCmd).toEqual([
        {
          _id: "__skip__",
          source: {
            command: {
              class: "DatabaseEnqueuer",
              handler: "copy_shift",
              args: [change, shiftedEvent.target.toObject()]
            },
            id: module.get(REPLICA_ID)
          },
          target: {
            commands: [
              {
                class: "DatabaseEnqueuer",
                handler: "copy_shift",
                args: [change, shiftedEvent.target.toObject()]
              }
            ]
          }
        }
      ]);
    });
  });
});
