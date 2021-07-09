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
import {tmpdir} from "os";

describe("Status", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({formats: [OBJECTID_STRING, DATE_TIME]}),
        DatabaseTestingModule.replicaSet(),
        PassportTestingModule.initialize(),
        PolicyModule.forRoot(),
        StatusModule,
        CoreTestingModule,
        PreferenceTestingModule,
        BucketModule.forRoot({
          cache: false,
          history: false,
          hooks: false,
          realtime: false,
          bucketDataLimit: 100
        }),
        IdentityModule.forRoot({
          expiresIn: 1000,
          issuer: "spica",
          maxExpiresIn: 1000,
          secretOrKey: "spica",
          entryLimit: 20
        }),
        FunctionModule.forRoot({
          path: tmpdir(),
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
          logExpireAfterSeconds: 60
        })
      ]
    }).compile();
    app = module.createNestApplication();
    req = module.get(Request);
    await app.listen(req.socket);
  });

  afterEach(async () => await app.close());

  describe("bucket", () => {
    it("should status of bucket module", async () => {
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
      await Promise.all(
        new Array(3).fill(undefined).map(() => req.post(`/bucket/${bucket1Id}/data`))
      );
      await Promise.all(
        new Array(5).fill(undefined).map(() => req.post(`/bucket/${bucket2Id}/data`))
      );

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
            current: 5
          },
          "bucket-data": {
            limit: 100,
            current: 8
          }
        }
      });
    });
  });

  describe("identity", () => {
    it("should work", async () => {
      // insert identities
      await Promise.all([
        req.post("/passport/identity", {
          identifier: "Naya",
          password: "something_secret"
        }),
        req.post("/passport/identity", {
          identifier: "xavier",
          password: "very_secret"
        })
      ]);

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

  describe("function", () => {
    
  });
});
