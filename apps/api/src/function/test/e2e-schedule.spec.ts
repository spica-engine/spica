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
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {Scheduler} from "@spica-server/function/scheduler";
import {event} from "@spica-server/function/queue/proto";
import {JobReducer, ReplicationModule} from "@spica-server/replication";

function sleep(ms: number) {
  return new Promise((resolve, _) => setTimeout(resolve, ms));
}

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

function getModuleBuilder(connectionUri?: string, dbName?: string) {
  return Test.createTestingModule({
    imports: [
      CoreTestingModule,
      connectionUri
        ? DatabaseTestingModule.connect(connectionUri, dbName)
        : DatabaseTestingModule.replicaSet(),
      PreferenceTestingModule,
      PassportTestingModule.initialize({overriddenStrategyType: "JWT"}),
      SchemaModule.forRoot({formats: [OBJECT_ID]}),
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
        tsCompilerPath: process.env.FUNCTION_TS_COMPILER_PATH,
        realtime: false
      }),
      ReplicationModule.forRoot()
    ]
  });
}

async function startApp(grpcaddresses: string[]) {
  let fn;

  const module = await getModuleBuilder().compile();
  const db = module.get(DatabaseService);
  await db.collection("my_coll").insertOne({test: "123"});

  const connectionUri = getConnectionUri();
  const module2 = await getModuleBuilder(connectionUri, db.databaseName).compile();

  const secondRepReducer = module2.get(JobReducer);
  const copyDo = secondRepReducer.do;
  secondRepReducer.do = async (...args) => {
    await sleep(1);
    return copyDo.bind(secondRepReducer)(...args);
  };

  module.enableShutdownHooks();
  module2.enableShutdownHooks();

  process.env.FUNCTION_GRPC_ADDRESS = grpcaddresses[0];
  const app = await module.createNestApplication().init();

  process.env.FUNCTION_GRPC_ADDRESS = grpcaddresses[1];
  const app2 = await module2.createNestApplication().init();

  const scheduler = module.get(Scheduler);
  const scheduler2 = module2.get(Scheduler);

  const req = module.get(Request);
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
          active: false
        }
      },
      memoryLimit: 100
    })
    .then(res => res.body);

  await req.post(`/function/${fn._id}/index`, {
    index: `export async function http(req,res){
          await new Promise((resolve,reject) => setTimeout(resolve,5000));
          return res.status(200).send("OK")
        }
        export function scheduler(){
          return "OK";
        }
        `
  });

  return {
    app,
    app2,
    req,
    scheduler,
    scheduler2,
    db,
    fn
  };
}

describe("Queue shifting - Schedule", () => {
  let app: INestApplication;
  let app2: INestApplication;
  let req: Request;
  let scheduler: Scheduler;
  let scheduler2: Scheduler;
  let fn;

  beforeEach(async () => {
    const res = await startApp(["0.0.0.0:38748", "0.0.0.0:34954"]);
    app = res.app;
    app2 = res.app2;
    req = res.req;
    scheduler = res.scheduler;
    scheduler2 = res.scheduler2;
    fn = res.fn;

    updateSchedulerTrigger(true);
  });

  afterEach(async () => {
    try {
      await Promise.all([app.close().catch(console.error), app2.close()]);
    } catch (error) {
      console.error(error);
    }
  });

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
