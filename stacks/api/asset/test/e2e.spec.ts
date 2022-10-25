import {INestApplication, ModuleMetadata} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {ReplicationTestingModule} from "@spica-server/replication/testing";
import {Asset, AssetModule} from "@spica-server/asset";
import {FunctionModule} from "@spica-server/function";
import * as os from "os";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:45678";

describe("E2E Tests", () => {
  let req: Request;
  let app: INestApplication;

  const moduleMeta: ModuleMetadata = {
    imports: [
      CoreTestingModule,
      DatabaseTestingModule.replicaSet(),
      PreferenceTestingModule,
      PassportTestingModule.initialize(),
      // SchemaModule.forRoot({formats: [OBJECT_ID]}),
      BucketModule.forRoot({
        hooks: false,
        history: false,
        realtime: false,
        cache: false,
        graphql: false
      }),
      AssetModule,
      ReplicationTestingModule.create(),
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
        realtimeLogs: false
      })
    ]
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule(moduleMeta).compile();

    app = module.createNestApplication();
    req = module.get(Request);

    await app.listen(req.socket);

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__skip__" && typeof actual == typeof expected) {
        return true;
      }
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe("Core", () => {
    describe("get", () => {
      let downloaded, installed, failed;

      beforeEach(async () => {
        downloaded = {
          name: "asset1",
          description: "description1",
          resources: [],
          configs: []
        };

        installed = {
          name: "asset2",
          description: "description2",
          resources: [],
          configs: []
        };

        failed = {
          name: "asset3",
          description: "description3",
          resources: [
            {
              module: "non_exist_module"
            }
          ],
          configs: []
        };

        downloaded = await req.post("asset", downloaded).then(r => r.body);

        installed = await req.post("asset", installed).then(r => r.body);
        installed = await req.post(`asset/${installed._id}`, []).then(r => r.body);

        failed = await req.post("asset", failed).then(r => r.body);
        await req.post(`asset/${failed._id}`, []);
      });

      it("should get asset1", async () => {
        const assets = await req.get("asset", {name: "asset1"}).then(r => r.body);
        expect(assets).toEqual([
          {
            _id: downloaded._id,
            name: "asset1",
            description: "description1",
            resources: [],
            configs: [],
            status: "downloaded"
          }
        ]);
      });

      it("should get downlaoded assets", async () => {
        const assets = await req.get("asset", {status: "downloaded"}).then(r => r.body);
        expect(assets).toEqual([
          {
            _id: downloaded._id,
            name: "asset1",
            description: "description1",
            resources: [],
            configs: [],
            status: "downloaded"
          }
        ]);
      });

      it("should get installed assets", async () => {
        const assets = await req.get("asset", {status: "installed"}).then(r => r.body);
        expect(assets).toEqual([
          {
            _id: installed._id,
            name: "asset2",
            description: "description2",
            resources: [],
            configs: [],
            status: "installed"
          }
        ]);
      });

      it("should get failed assets", async () => {
        const assets = await req.get("asset", {status: "failed"}).then(r => r.body);
        expect(assets).toEqual([
          {
            _id: failed._id,
            name: "asset3",
            description: "description3",
            resources: [
              {
                module: "non_exist_module"
              }
            ],
            configs: [],
            status: "failed",
            failure_message: "Validation has been failed: Unknown module named 'non_exist_module'."
          }
        ]);
      });
    });

    describe("download", () => {
      it("should download the asset", async () => {
        const asset = {
          name: "asset1",
          description: "desc1",
          resources: [],
          configs: []
        };

        const res = await req.post("asset", asset);

        expect(res.statusCode).toEqual(201);
        expect(res.body).toEqual({
          _id: "__skip__",
          name: "asset1",
          description: "desc1",
          resources: [],
          configs: [],
          status: "downloaded"
        });
      });
    });

    describe("install", () => {
      it("should install the asset", async () => {
        let asset: any = {
          name: "asset1",
          description: "desc1",
          resources: [],
          configs: []
        };

        asset = await req.post("asset", asset).then(r => r.body);
        const res = await req.post(`asset/${asset._id}`, []);

        expect(res.statusCode).toEqual(201);
        expect(res.body).toEqual({
          _id: "__skip__",
          name: "asset1",
          description: "desc1",
          resources: [],
          configs: [],
          status: "installed"
        });
      });

      it("should preview asset installation", async () => {
        let asset: any = {
          name: "asset1",
          description: "desc1",
          resources: [],
          configs: []
        };

        asset = await req.post("asset", asset).then(r => r.body);
        let res = await req.post(`asset/${asset._id}`, [], {}, {preview: true});

        expect(res.statusCode).toEqual(201);
        expect(res.body).toEqual({
          insertions: [],
          updations: [],
          deletions: []
        });

        res = await req.get(`asset/${asset._id}`);
        expect(res.body).toEqual({
          _id: "__skip__",
          name: "asset1",
          description: "desc1",
          resources: [],
          configs: [],
          // not installed!
          status: "downloaded"
        });
      });

      it("asset update asset from v1 to v2", async () => {
        let assetv1: any = {
          name: "asset",
          description: "v1",
          configs: [],
          resources: []
        };

        let assetv2: any = {
          ...assetv1,
          description: "v2"
        };

        assetv1 = await req.post(`asset`, assetv1).then(r => r.body);
        await req.post(`asset/${assetv1._id}`);

        assetv2 = await req.post(`asset`, assetv2).then(r => r.body);

        let assets = await req.get("asset").then(r => r.body);
        expect(assets).toEqual([
          {
            _id: "__skip__",
            name: "asset",
            description: "v1",
            configs: [],
            resources: [],
            status: "installed"
          },
          {
            _id: "__skip__",
            name: "asset",
            description: "v2",
            configs: [],
            resources: [],
            status: "downloaded"
          }
        ]);

        await req.post(`asset/${assetv2._id}`);
        assets = await req.get("asset").then(r => r.body);
        expect(assets).toEqual([
          {
            _id: "__skip__",
            name: "asset",
            description: "v1",
            configs: [],
            resources: [],
            status: "downloaded"
          },
          {
            _id: "__skip__",
            name: "asset",
            description: "v2",
            configs: [],
            resources: [],
            status: "installed"
          }
        ]);
      });

      it("should throw error if asset does not exist", async () => {
        const res = await req.post(`asset/000000000000000000000000`);
        expect(res.statusCode).toEqual(404);
        expect(res.body.message).toEqual("Not Found");
      });

      it("should throw error if asset is already installed", async () => {
        let asset: any = {
          name: "asset",
          description: "description",
          configs: [],
          resources: []
        };

        asset = await req.post("asset", asset).then(r => r.body);
        await req.post(`asset/${asset._id}`);

        const res = await req.post(`asset/${asset._id}`);

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toEqual("Asset is already installed.");
      });

      it("should throw error if validation failed while installing asset", async () => {
        let asset: any = {
          name: "asset",
          description: "description",
          resources: [
            {
              module: "non_exist_module"
            }
          ],
          configs: []
        };

        asset = await req.post("asset", asset).then(r => r.body);
        const res = await req.post(`asset/${asset._id}`, []);

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toEqual(
          "Validation has been failed: Unknown module named 'non_exist_module'."
        );

        const existing = await req.get(`asset/${asset._id}`).then(r => r.body);
        expect(existing).toEqual({
          _id: "__skip__",
          name: "asset",
          description: "description",
          resources: [
            {
              module: "non_exist_module"
            }
          ],
          configs: [],
          status: "failed",
          failure_message: "Validation has been failed: Unknown module named 'non_exist_module'."
        });
      });
    });

    describe("delete", () => {
      it("should soft delete the asset as default", async () => {
        let asset: any = {
          name: "asset",
          description: "desc",
          resources: [],
          configs: []
        };

        asset = await req.post("asset", asset).then(r => r.body);
        let res = await req.post(`asset/${asset._id}`, []);

        // ensure that asset is installed
        expect(res.body).toEqual({
          ...asset,
          status: "installed"
        });

        res = await req.delete(`asset/${asset._id}`);
        expect(res.statusCode).toEqual(204);
        expect(res.body).toEqual(undefined);

        res = await req.get(`asset/${asset._id}`);
        expect(res.body).toEqual({
          _id: "__skip__",
          name: "asset",
          description: "desc",
          resources: [],
          configs: [],
          status: "downloaded"
        });
      });

      it("should hard delete the asset", async () => {
        let asset: any = {
          name: "asset",
          description: "desc",
          resources: [],
          configs: []
        };

        asset = await req.post("asset", asset).then(r => r.body);
        let res = await req.post(`asset/${asset._id}`, []);

        // ensure that asset is installed
        expect(res.body).toEqual({
          ...asset,
          status: "installed"
        });

        res = await req.request({
          path: `asset/${asset._id}`,
          method: "DELETE",
          query: {type: "hard"}
        });
        expect(res.statusCode).toEqual(204);
        expect(res.body).toEqual(undefined);

        res = await req.get(`asset/${asset._id}`);
        expect(res.statusCode).toEqual(404);
        expect(res.body.message).toEqual("Not Found");
      });
    });
  });

  xdescribe("Bucket", () => {
    let bucket1;
    const bucket1Id = new ObjectId();

    beforeEach(() => {
      bucket1 = {
        _id: bucket1Id,
        module: "bucket",
        title: "bucket1",
        properties: {
          name: {
            type: "string"
          }
        }
      };
    });

    describe("install", () => {
      it("should install bucket asset", async () => {
        let asset: any = {
          name: "bucket asset",
          description: "description",
          configs: [],
          resources: [bucket1]
        };

        asset = await req.post("asset", asset).then(r => r.body);
        await req
          .post(`asset/${asset._id}`)
          .then(console.log)
          .catch(console.log);

        const buckets = await req.get("bucket").then(r => r.body);
        expect(buckets).toEqual({
          _id: bucket1Id,
          module: "bucket",
          title: "bucket1",
          properties: {
            name: {
              type: "string"
            }
          }
        });
      });
    });
  });
});
