import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {Middlewares} from "@spica-server/core";
import {SchemaModule} from "@spica-server/core/schema";
import {DATE_TIME, OBJECTID_STRING} from "@spica-server/core/schema/formats";
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

const MB = Math.pow(10, 6);
const KB = Math.pow(10, -6);

describe("Status", () => {
  describe("Bucket", () => {
    let module: TestingModule;
    let app: INestApplication;
    let req: Request;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          SchemaModule.forRoot({formats: [OBJECTID_STRING, DATE_TIME]}),
          DatabaseTestingModule.replicaSet(),
          StatusModule,
          CoreTestingModule,
          PassportTestingModule.initialize(),
          PreferenceTestingModule,
          BucketModule.forRoot({
            cache: false,
            history: false,
            hooks: false,
            realtime: false,
            bucketDataLimit: 100
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
            current: 2
          },
          [`bucket_${bucket1Id}`]: {
            limit: 10,
            current: 3
          },
          [`bucket_${bucket2Id}`]: {
            limit: 5,
            current: 2
          },
          "bucket-data": {
            limit: 100,
            current: 5
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
          StatusModule,
          CoreTestingModule,
          PassportTestingModule.initialize(),
          PreferenceTestingModule,
          IdentityModule.forRoot({
            expiresIn: 1000,
            issuer: "spica",
            maxExpiresIn: 1000,
            secretOrKey: "spica",
            entryLimit: 20
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
        password: "something_secret"
      });
      await req.post("/passport/identity", {
        identifier: "xavier",
        password: "very_secret"
      });

      const res = await req.get("/status/identity");
      expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
      expect(res.body).toEqual({
        module: "identity",
        status: {
          identities: {
            limit: 20,
            current: 2
          }
        }
      });
    });
  });

  xdescribe("Function", () => {
    let module: TestingModule;
    let app: INestApplication;
    let req: Request;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          DatabaseTestingModule.replicaSet(),
          StatusModule,
          CoreTestingModule,
          PassportTestingModule.initialize(),
          FunctionModule.forRoot({
            path: os.tmpdir(),
            databaseName: undefined,
            poolSize: 3,
            poolMaxSize: 3,
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
            entryLimit: 20
          })
        ]
      }).compile();
      app = module.createNestApplication();
      req = module.get(Request);

      await app.listen(req.socket);
    });

    afterEach(async () => await app.close());

    it("should return status of function module", async () => {
      const res = await req.get("/status/function");
      expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
      expect(res.body).toEqual({
        module: "function",
        status: {
          functions: {
            current: 0
          },
          workers: {
            limit: 3,
            current: 0
          }
        }
      });
    });
  });

  fdescribe("Storage", () => {
    let module: TestingModule;
    let app: INestApplication;
    let req: Request;

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          DatabaseTestingModule.standalone(),
          StatusModule,
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
      app = module.createNestApplication();
      app.use(Middlewares.JsonBodyParser({limit: 10 * MB, ignoreUrls: []}));
      req = module.get(Request);

      await app.listen(req.socket);
    });

    afterEach(async () => await app.close());

    fit("should return status of storage module", async () => {
      const data = 
      // insert storage
      await req
        .post("/storage", [
          {
            name: "test.txt",
            content: {type: "text/plain", data: data.toString()}
          }
        ])
        .then(r => {
          console.dir(r, {depth: Infinity});
        });

      const res = await req.get("/status/storage");
      expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
      expect(res.body).toEqual({
        module: "storage",
        status: {
          size: {
            limit: 10,
            current: 3
          }
        }
      });
    });
  });
});
