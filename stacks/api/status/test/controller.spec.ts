import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica-server/core/schema";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {FunctionModule} from "@spica-server/function";
import {IdentityModule} from "@spica-server/passport/identity";
import {PolicyModule} from "@spica-server/passport/policy";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {StatusModule} from "@spica-server/status";
import {StorageModule} from "@spica-server/storage";
import * as os from "os";
import * as BSON from "bson";
import {WsAdapter} from "@spica-server/core/websocket";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:50051";

function sleep(ms: number) {
  return new Promise((resolve, _) => setTimeout(resolve, ms));
}

describe("Status", () => {
  describe("Bucket", () => {
    let module: TestingModule;
    let app: INestApplication;
    let req: Request;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING, DATE_TIME]}),
          DatabaseTestingModule.replicaSet(),
          StatusModule.forRoot({expireAfterSeconds: 60}),
          CoreTestingModule,
          PassportTestingModule.initialize(),
          PreferenceTestingModule,
          BucketModule.forRoot({
            cache: false,
            history: false,
            hooks: false,
            realtime: false,
            bucketDataLimit: 100,
            graphql: false
          })
        ]
      }).compile();
      app = module.createNestApplication();
      req = module.get(Request);
      await app.listen(req.socket);
    });

    afterEach(async () => await app.close());

    it("should return status of bucket module", async () => {
      // insert buckets
      const [bucket1Id, bucket2Id] = await Promise.all([
        await req
          .post("/bucket", {
            title: "bucket",
            description: "bucket",
            properties: {title: {type: "string"}},
            documentSettings: {
              countLimit: 10,
              limitExceedBehaviour: "prevent"
            }
          })
          .then(r => r.body._id),
        await req
          .post("/bucket", {
            title: "bucket",
            description: "bucket",
            properties: {title: {type: "string"}},
            documentSettings: {
              countLimit: 5,
              limitExceedBehaviour: "prevent"
            }
          })
          .then(r => r.body._id)
      ]);
      //insert bucket-data
      await req.post(`/bucket/${bucket1Id}/data`);
      await req.post(`/bucket/${bucket1Id}/data`);
      await req.post(`/bucket/${bucket1Id}/data`);

      await req.post(`/bucket/${bucket2Id}/data`);
      await req.post(`/bucket/${bucket2Id}/data`);

      const res = await req.get("/status/bucket");
      expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
      expect(res.body).toEqual({
        module: "bucket",
        status: {
          buckets: {
            current: 2,
            unit: "count"
          },
          [`bucket_${bucket1Id}`]: {
            limit: 10,
            current: 3,
            unit: "count"
          },
          [`bucket_${bucket2Id}`]: {
            limit: 5,
            current: 2,
            unit: "count"
          },
          bucketData: {
            limit: 100,
            current: 5,
            unit: "count"
          }
        }
      });
    });
  });

  describe("Identity", () => {
    let module: TestingModule;
    let app: INestApplication;
    let req: Request;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          DatabaseTestingModule.standalone(),
          PolicyModule.forRoot(),
          StatusModule.forRoot({expireAfterSeconds: 60}),
          CoreTestingModule,
          PassportTestingModule.initialize(),
          PreferenceTestingModule,
          IdentityModule.forRoot({
            expiresIn: 1000,
            issuer: "spica",
            maxExpiresIn: 1000,
            secretOrKey: "spica",
            entryLimit: 20,
            blockingOptions: {
              failedAttemptLimit: 100,
              blockDurationMinutes: 0
            },
            passwordHistoryUniquenessCount: 0
          }),
          SchemaModule.forRoot({
            formats:[DATE_TIME]
          })
        ]
      }).compile();
      app = module.createNestApplication();
      req = module.get(Request);
      await app.listen(req.socket);
    });

    afterEach(async () => await app.close());

    it("should return status of identity module", async () => {
      // insert identities
      await req.post("/passport/identity", {
        identifier: "Naya",
        password: "somethingsecret123456"
      }).then(console.log).catch(console.log);
      await req.post("/passport/identity", {
        identifier: "xavier",
        password: "verysecret123456"
      });

      const res = await req.get("/status/identity");
      expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
      expect(res.body).toEqual({
        module: "identity",
        status: {
          identities: {
            limit: 20,
            current: 2,
            unit: "count"
          }
        }
      });
    });
  });

  describe("Function", () => {
    let module: TestingModule;
    let app: INestApplication;
    let req: Request;
    let fn;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          DatabaseTestingModule.replicaSet(),
          StatusModule.forRoot({expireAfterSeconds: 60}),
          CoreTestingModule,
          PassportTestingModule.initialize(),
          SchemaModule.forRoot({formats: [OBJECT_ID]}),
          FunctionModule.forRoot({
            path: os.tmpdir(),
            databaseName: undefined,
            databaseReplicaSet: undefined,
            databaseUri: undefined,
            apiUrl: undefined,
            timeout: 20,
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
          })
        ]
      }).compile();
      req = module.get(Request);

      app = module.createNestApplication();
      app.useWebSocketAdapter(new WsAdapter(app));

      await app.listen(req.socket);

      fn = await req
        .post("/function", {
          name: "test",
          description: "test",
          language: "javascript",
          timeout: 100,
          triggers: {
            default: {
              options: {
                method: "Get",
                path: "/test",
                preflight: true
              },
              type: "http",
              active: true
            }
          },
          env: {},
          memoryLimit: 100
        })
        .then(res => res.body);

      await req.post(`/function/${fn._id}/index`, {
        index: `export default function(){ return "OK"; }`
      });
    });

    afterEach(async () => await app.close());

    it("should return status of function module", async () => {
      // wait until worker spawned
      await sleep(2000);

      let res = await req.get("/status/function");
      expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
      expect(res.body).toEqual({
        module: "function",
        status: {
          functions: {
            limit: 20,
            current: 1,
            unit: "count"
          },
          workers: {
            activated: 0,
            fresh: 1,
            unit: "count"
          }
        }
      });

      await req.get("/fn-execute/test");

      res = await req.get("/status/function");
      expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
      expect(res.body).toEqual({
        module: "function",
        status: {
          functions: {
            limit: 20,
            current: 1,
            unit: "count"
          },
          workers: {
            activated: 1,
            fresh: 1,
            unit: "count"
          }
        }
      });
    });
  });

  describe("Storage", () => {
    let module: TestingModule;
    let app: INestApplication;
    let req: Request;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          DatabaseTestingModule.standalone(),
          StatusModule.forRoot({expireAfterSeconds: 60}),
          CoreTestingModule,
          PassportTestingModule.initialize(),
          StorageModule.forRoot({
            objectSizeLimit: 10,
            strategy: "default",
            totalSizeLimit: 10,
            defaultPath: "test"
          })
        ]
      }).compile();
      app = module.createNestApplication(undefined, {bodyParser: false});
      req = module.get(Request);

      await app.listen(req.socket);
    });

    afterEach(async () => await app.close());

    it("should return status of storage module", async () => {
      // insert storage
      await req.post("/storage", [
        {
          name: "test.txt",
          content: {
            type: "text/plain",
            data: new BSON.Binary(Buffer.alloc(3 * 1000 * 1000))
          }
        }
      ]);

      const res = await req.get("/status/storage");
      expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
      expect(res.body).toEqual({
        module: "storage",
        status: {
          size: {
            limit: 10,
            current: 3,
            unit: "mb"
          }
        }
      });
    });
  });
});
