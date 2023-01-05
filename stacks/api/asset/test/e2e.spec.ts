import {INestApplication, ModuleMetadata} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {ReplicationTestingModule} from "@spica-server/replication/testing";
import {AssetModule} from "@spica-server/asset";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import * as os from "os";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:45672";

describe("E2E Tests", () => {
  describe("Core", () => {
    function downloadAsset(asset) {
      return req.post("asset", asset).then(r => r.body);
    }

    function previewAssetInstallation(id, configs = []) {
      return req.post(`asset/${id}`, {configs}, {}, {preview: true}).then(r => r.body);
    }

    function installAsset(id, configs = []) {
      return req.post(`asset/${id}`, {configs}).then(r => r.body);
    }

    function deleteAsset(id) {
      return req.delete(`asset/${id}`);
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
        PassportTestingModule.initialize({overriddenStrategyType: "JWT"}),
        SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
        AssetModule.forRoot({persistentPath: os.tmpdir()}),
        ReplicationTestingModule.create()
      ]
    };

    beforeEach(async () => {
      const module = await Test.createTestingModule(moduleMeta).compile();

      app = module.createNestApplication();
      req = module.get(Request);

      await app.listen(req.socket);

      await new Promise((resolve, _) => setTimeout(resolve, 3000));

      const token = await req
        .post("/passport/identify", {identifier: "spica", password: "spica"})
        .then(r => r.body.token);
      req.setDefaultHeaders({Authorization: `IDENTITY ${token}`});

      jasmine.addCustomEqualityTester((actual, expected) => {
        if (expected == "__skip__" && typeof actual == typeof expected) {
          return true;
        }
      });
    }, 10_000);

    afterEach(async () => {
      await app.get(DatabaseService).dropDatabase();
      await app.close();
    });
    describe("get", () => {
      let downloaded, installed, failed;

      beforeEach(async () => {
        downloaded = {
          name: "asset1",
          description: "description1",
          resources: [],
          configs: [],
          url: "1"
        };

        installed = {
          name: "assetv2",
          description: "description2",
          resources: [],
          configs: [],
          url: "2"
        };

        failed = {
          name: "asset3",
          description: "description3",
          resources: [
            {
              module: "non_exist_module"
            }
          ],
          configs: [],
          url: "3"
        };

        downloaded = await downloadAsset(downloaded);

        installed = await downloadAsset(installed);
        installed = await installAsset(installed._id);

        failed = await downloadAsset(failed);
        await installAsset(failed._id);
      });

      it("should get asset1", async () => {
        const assets = await req
          .get("/asset", {filter: JSON.stringify({name: "asset1"})})
          .then(r => r.body);
        expect(assets).toEqual([
          {
            _id: downloaded._id,
            name: "asset1",
            description: "description1",
            resources: [],
            configs: [],
            status: "downloaded",
            url: "1"
          }
        ]);
      });

      it("should get downlaoded assets", async () => {
        const assets = await req
          .get("asset", {filter: JSON.stringify({status: "downloaded"})})
          .then(r => r.body);
        expect(assets).toEqual([
          {
            _id: downloaded._id,
            name: "asset1",
            description: "description1",
            resources: [],
            configs: [],
            status: "downloaded",
            url: "1"
          }
        ]);
      });

      it("should get installed assets", async () => {
        const assets = await req
          .get("asset", {filter: JSON.stringify({status: "installed"})})
          .then(r => r.body);
        expect(assets).toEqual([
          {
            _id: installed._id,
            name: "assetv2",
            description: "description2",
            resources: [],
            configs: [],
            status: "installed",
            url: "2"
          }
        ]);
      });

      it("should get failed assets", async () => {
        const assets = await req
          .get("asset", {filter: JSON.stringify({status: "failed"})})
          .then(r => r.body);
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
            failure_message:
              "Error: Operation insert has been failed: Unknown module named 'non_exist_module'.",
            url: "3"
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
          configs: [],
          url: "1"
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
          status: "downloaded",
          url: "1"
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
          configs: [],
          url: "1"
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
          status: "installed",
          url: "1"
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
          status: "downloaded",
          url: "1"
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

        const res = await installAsset(asset._id);

        let assets = await getAssets();
        expect(assets).toEqual([
          {
            _id: asset._id,
            name: "asset1",
            description: "desc1",
            configs: [],
            resources: [],
            status: "installed",
            url: "1"
          },
          {
            _id: assetv2._id,
            name: "asset1",
            description: "v2",
            configs: [],
            resources: [],
            status: "downloaded",
            url: "1"
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
            status: "downloaded",
            url: "1"
          },
          {
            _id: assetv2._id,
            name: "asset1",
            description: "v2",
            configs: [],
            resources: [],
            status: "installed",
            url: "1"
          }
        ]);
      });

      describe("errors", () => {
        it("should throw error if asset does not exist", async () => {
          const res = await req.post(`asset/000000000000000000000000`, {configs: []});
          expect(res.statusCode).toEqual(404);
          expect(res.body.message).toEqual("Not Found");
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

          expect(res.statusCode).toEqual(500);
          expect(res.body.message).toEqual(
            "Error: Operation insert has been failed: Unknown module named 'non_exist_module'."
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
            failure_message:
              "Error: Operation insert has been failed: Unknown module named 'non_exist_module'.",
            url: "1"
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
          configs: [],
          url: "1"
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
          status: "downloaded",
          url: "1"
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
});
