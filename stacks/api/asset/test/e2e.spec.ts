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
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import * as os from "os";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:45678";

describe("E2E Tests", () => {
  function downloadAsset(asset) {
    return req.post("asset", asset).then(r => r.body);
  }

  function previewAssetInstallation(id, configs = []) {
    return req.post(`asset/${id}`, {configs}, {}, {preview: true}).then(r => r.body);
  }

  function installAsset(id, configs = []) {
    return req.post(`asset/${id}`, {configs}).then(r => r.body);
  }

  function getAsset(id) {
    return req.get(`asset/${id}`).then(r => r.body);
  }

  function getAssets() {
    return req.get("asset").then(r => r.body);
  }

  let req: Request;
  let app: INestApplication;

  const moduleMeta: ModuleMetadata = {
    imports: [
      CoreTestingModule,
      DatabaseTestingModule.replicaSet(),
      PreferenceTestingModule,
      PassportTestingModule.initialize(),
      SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
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
          name: "assetv2",
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

        downloaded = await downloadAsset(downloaded);

        installed = await downloadAsset(installed);
        installed = await installAsset(installed._id);

        failed = await downloadAsset(failed);
        await installAsset(failed._id);
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
            name: "assetv2",
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
      let asset;

      beforeEach(() => {
        asset = {
          name: "asset1",
          description: "desc1",
          resources: [],
          configs: []
        };
      });

      it("should download the asset", async () => {
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

      it("should throw error for additional properties", async () => {
        const res = await req.post("asset", {...asset, reject: "me"});

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toEqual("should NOT have additional properties 'reject'");
      });

      it("should throw error for missing required properties", async () => {
        delete asset.name;

        const res = await req.post("asset", asset);

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toEqual(" should have required property 'name'");
      });

      it("should throw error for wrong typed properties", async () => {
        asset.description = 1000;

        const res = await req.post("asset", asset);

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toEqual(".description should be string");
      });
    });

    describe("install", () => {
      let asset;

      beforeEach(async () => {
        asset = {
          name: "asset1",
          description: "desc1",
          resources: [],
          configs: []
        };

        asset = await downloadAsset(asset);
      });

      it("should install the asset", async () => {
        const res = await req.post(`asset/${asset._id}`, {configs: []});

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
        const res = await req.post(`asset/${asset._id}`, {configs: []}, {}, {preview: true});

        expect(res.statusCode).toEqual(201);
        expect(res.body).toEqual({
          insertions: [],
          updations: [],
          deletions: []
        });

        asset = await getAsset(asset._id);
        expect(asset).toEqual({
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
        let assetv2 = {
          ...asset,
          description: "v2"
        };
        delete assetv2._id;
        delete assetv2.status;

        assetv2 = await downloadAsset(assetv2);

        await installAsset(asset._id);

        let assets = await getAssets();
        expect(assets).toEqual([
          {
            _id: asset._id,
            name: "asset1",
            description: "desc1",
            configs: [],
            resources: [],
            status: "installed"
          },
          {
            _id: assetv2._id,
            name: "asset1",
            description: "v2",
            configs: [],
            resources: [],
            status: "downloaded"
          }
        ]);

        await installAsset(assetv2._id);

        assets = await getAssets();
        expect(assets).toEqual([
          {
            _id: asset._id,
            name: "asset1",
            description: "desc1",
            configs: [],
            resources: [],
            status: "downloaded"
          },
          {
            _id: assetv2._id,
            name: "asset1",
            description: "v2",
            configs: [],
            resources: [],
            status: "installed"
          }
        ]);
      });

      describe("errors", () => {
        it("should throw error if asset does not exist", async () => {
          const res = await req.post(`asset/000000000000000000000000`, {configs: []});
          expect(res.statusCode).toEqual(404);
          expect(res.body.message).toEqual("Not Found");
        });

        it("should throw error if asset is already installed", async () => {
          await installAsset(asset._id);

          const res = await req.post(`asset/${asset._id}`, {configs: []});

          expect(res.statusCode).toEqual(400);
          expect(res.body.message).toEqual("Asset is already installed.");
        });

        it("should throw error if validation failed while installing asset", async () => {
          asset = {
            ...asset,
            resources: [
              {
                module: "non_exist_module"
              }
            ]
          };

          delete asset._id;
          delete asset.status;

          asset = await downloadAsset(asset);
          const res = await req.post(`asset/${asset._id}`, {configs: []});

          expect(res.statusCode).toEqual(400);
          expect(res.body.message).toEqual(
            "Validation has been failed: Unknown module named 'non_exist_module'."
          );

          const existing = await getAsset(asset._id);
          expect(existing).toEqual({
            _id: asset._id,
            name: "asset1",
            description: "desc1",
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
    });

    describe("delete", () => {
      let asset;

      beforeEach(async () => {
        asset = {
          name: "asset",
          description: "desc",
          resources: [],
          configs: []
        };

        asset = await downloadAsset(asset);
        await installAsset(asset._id);
      });

      it("should soft delete the asset as default", async () => {
        const res = await req.delete(`asset/${asset._id}`);
        expect(res.statusCode).toEqual(204);
        expect(res.body).toEqual(undefined);

        asset = await getAsset(asset._id);
        expect(asset).toEqual({
          _id: "__skip__",
          name: "asset",
          description: "desc",
          resources: [],
          configs: [],
          status: "downloaded"
        });
      });

      it("should hard delete the asset", async () => {
        let res = await req.request({
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

  describe("Bucket", () => {
    function getBuckets() {
      return req.get("bucket").then(r => r.body);
    }

    function getBucket(id) {
      return req.get(`bucket/${id}`).then(r => r.body);
    }

    let bucketv1Resource;
    let bucketv1;
    const bucketId = new ObjectId().toString();

    let bucketv2Resource;
    let bucketv2;

    let assetv1;
    let assetv2;

    beforeEach(async () => {
      bucketv1 = {
        _id: bucketId,
        title: "my_bucket",
        description: "description",
        acl: {
          write: "true==true",
          read: "true==true"
        },
        properties: {
          name: {
            type: "string"
          }
        },
        history: false,
        icon: "view_stream"
      };

      bucketv1Resource = {
        _id: bucketId,
        module: "bucket",
        contents: {
          schema: bucketv1
        }
      };

      bucketv2 = {...bucketv1, properties: {title: {type: "string"}}};

      bucketv2Resource = {...bucketv1Resource, contents: {schema: bucketv2}};
    });

    beforeEach(async () => {
      assetv1 = {
        name: "bucket asset",
        description: "description",
        configs: [],
        resources: [bucketv1Resource]
      };

      assetv2 = {...assetv1, resources: [bucketv2Resource]};

      assetv1 = await downloadAsset(assetv1);
    });

    describe("insertions", () => {
      it("should preview bucket asset installation", async () => {
        const preview = await previewAssetInstallation(assetv1._id);

        expect(preview).toEqual({insertions: [bucketv1Resource], updations: [], deletions: []});

        assetv1 = await getAsset(assetv1._id);
        expect(assetv1.status).toEqual("downloaded");

        const buckets = await getBuckets();
        expect(buckets).toEqual([]);
      });

      it("should install bucket asset", async () => {
        await installAsset(assetv1._id);

        const buckets = await getBuckets();
        expect(buckets).toEqual([bucketv1]);

        const bucket = await getBucket(bucketId);
        expect(bucket).toEqual(bucketv1);
      });
    });

    describe("updations", () => {
      beforeEach(async () => {
        await installAsset(assetv1._id);
        assetv2 = await downloadAsset(assetv2);
      });

      it("should preview bucket asset installation", async () => {
        const preview = await previewAssetInstallation(assetv2._id);
        expect(preview).toEqual({insertions: [], updations: [bucketv2Resource], deletions: []});

        assetv1 = await getAsset(assetv1._id);
        expect(assetv1.status).toEqual("installed");

        assetv2 = await getAsset(assetv2._id);
        expect(assetv2.status).toEqual("downloaded");

        const buckets = await getBuckets();
        expect(buckets).toEqual([bucketv1]);
      });

      it("should install bucket asset", async () => {
        await installAsset(assetv2._id);

        assetv1 = await getAsset(assetv1._id);
        expect(assetv1.status).toEqual("downloaded");

        assetv2 = await getAsset(assetv2._id);
        expect(assetv2.status).toEqual("installed");

        const buckets = await getBuckets();
        expect(buckets).toEqual([bucketv2]);
      });
    });

    describe("deletions", () => {
      beforeEach(async () => {
        await installAsset(assetv1._id);

        assetv2 = {...assetv1, resources: []};
        delete assetv2._id;
        delete assetv2.status;

        assetv2 = await downloadAsset(assetv2);
      });

      it("should preview bucket asset installation", async () => {
        const preview = await previewAssetInstallation(assetv2._id);
        expect(preview).toEqual({insertions: [], updations: [], deletions: [bucketv1Resource]});

        assetv1 = await getAsset(assetv1._id);
        expect(assetv1.status).toEqual("installed");

        assetv2 = await getAsset(assetv2._id);
        expect(assetv2.status).toEqual("downloaded");

        const buckets = await getBuckets();
        expect(buckets).toEqual([bucketv1]);
      });

      it("should install bucket asset", async () => {
        await installAsset(assetv2._id);

        assetv1 = await getAsset(assetv1._id);
        expect(assetv1.status).toEqual("downloaded");

        assetv2 = await getAsset(assetv2._id);
        expect(assetv2.status).toEqual("installed");

        const buckets = await getBuckets();
        expect(buckets).toEqual([]);
      });
    });
  });
});
