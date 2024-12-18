import {INestApplication, ModuleMetadata} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {AssetModule, exporters, operators, registrar, validators} from "@spica-server/asset";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import * as os from "os";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:45672";

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

  function deleteAsset(id, type: "hard" | "soft" = "soft") {
    return req.delete(`asset/${id}`, {}, {}, {type});
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
      PassportTestingModule.initialize({overriddenStrategyType: "identity"}),
      SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
      AssetModule.forRoot({persistentPath: os.tmpdir()})
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

  describe("Core", () => {
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
            url: "1",
            icon: "check_circle_outline"
          }
        ]);
      });

      it("should get downlaoded assets", async () => {
        const assets = await req
          .get("asset", {filter: JSON.stringify({status: "downloaded"})})
          .then(r => r.body);
        expect(assets).toEqual(
          [
            {
              _id: downloaded._id,
              name: "asset1",
              description: "description1",
              resources: [],
              configs: [],
              status: "downloaded",
              url: "1",
              icon: "check_circle_outline"
            },
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
              url: "3",
              status: "downloaded",
              icon: "check_circle_outline"
            }
          ],
          `if installation was failed because of the asset definition(not resource,
          which means installation fails before start), 
          status should be downloaded.`
        );
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
            url: "2",
            icon: "check_circle_outline"
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
          url: "1",
          icon: "check_circle_outline"
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
          url: "1",
          icon: "check_circle_outline"
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
          url: "1",
          icon: "check_circle_outline"
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
            status: "installed",
            url: "1",
            icon: "check_circle_outline"
          },
          {
            _id: assetv2._id,
            name: "asset1",
            description: "v2",
            configs: [],
            resources: [],
            status: "downloaded",
            url: "1",
            icon: "check_circle_outline"
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
            url: "1",
            icon: "check_circle_outline"
          },
          {
            _id: assetv2._id,
            name: "asset1",
            description: "v2",
            configs: [],
            resources: [],
            status: "installed",
            url: "1",
            icon: "check_circle_outline"
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
            status: "downloaded",
            url: "1",
            icon: "check_circle_outline"
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
          url: "1",
          icon: "check_circle_outline"
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

  describe("with module", () => {
    let asset;

    beforeEach(async () => {
      asset = {
        name: "asset1",
        description: "description1",
        resources: [
          {
            _id: "1",
            contents: {
              schema: {}
            },
            module: "module1"
          }
        ],
        configs: [],
        url: "1",
        icon: "check_circle_outline"
      };
    });

    afterEach(() => {
      validators.clear();
      operators.clear();
      exporters.clear();
    });

    describe("validation failed", () => {
      beforeEach(async () => {
        asset = await downloadAsset(asset);

        const validator = async () => await Promise.reject("Schema cannot be empty");
        registrar.validator("module1", validator);
      });

      it("should show validation failure message", async () => {
        const res = await installAsset(asset._id);

        expect(res.statusCode).toEqual(400);
        expect(res.message).toEqual(
          `Module 'module1' resource '1' validation has been failed: Schema cannot be empty`
        );
      });
    });

    describe("validation succeeded", () => {
      beforeEach(async () => {
        asset = await downloadAsset(asset);

        const validator = async () => await Promise.resolve();
        registrar.validator("module1", validator);
      });

      it("should show preview", async () => {
        const res = await previewAssetInstallation(asset._id);

        expect(res).toEqual({
          insertions: [
            {
              _id: "1",
              contents: {
                schema: {}
              },
              module: "module1"
            }
          ],
          updations: [],
          deletions: []
        });
      });
    });

    describe("installation succeeded", () => {
      beforeEach(async () => {
        asset = await downloadAsset(asset);

        const validator = async () => await Promise.resolve();
        registrar.validator("module1", validator);

        const operator = {
          insert: () => Promise.resolve(),
          update: () => Promise.resolve(),
          delete: () => Promise.resolve()
        };
        registrar.operator("module1", operator);
      });

      it("should install asset and its resource", async () => {
        await installAsset(asset._id);

        const res = await getAsset(asset._id);
        expect(res).toEqual({
          _id: asset._id,
          name: "asset1",
          description: "description1",
          resources: [
            {
              _id: "1",
              contents: {
                schema: {}
              },
              module: "module1",
              installation_status: "installed"
            }
          ],
          configs: [],
          url: "1",
          icon: "check_circle_outline",
          status: "installed"
        });
      });
    });

    describe("partially installed", () => {
      let operator;
      beforeEach(async () => {
        asset.resources.push({
          _id: "2",
          contents: {
            schema: {}
          },
          module: "module1"
        });
        asset = await downloadAsset(asset);

        const validator = async () => await Promise.resolve();
        registrar.validator("module1", validator);

        operator = {
          insert: r =>
            r._id != "1" ? Promise.resolve() : Promise.reject("Resource can't be inserted"),
          update: () => Promise.resolve(),
          delete: () => Promise.resolve()
        };
        registrar.operator("module1", operator);
      });

      it("should keep installing even if there is failed resource installation", async () => {
        await installAsset(asset._id);

        const res = await getAsset(asset._id);
        expect(res).toEqual({
          _id: asset._id,
          name: "asset1",
          description: "description1",
          resources: [
            {
              _id: "1",
              contents: {
                schema: {}
              },
              module: "module1",
              installation_status: "failed",
              failure_message: "Resource can't be inserted"
            },
            {
              _id: "2",
              contents: {
                schema: {}
              },
              module: "module1",
              installation_status: "installed"
            }
          ],
          configs: [],
          url: "1",
          icon: "check_circle_outline",
          status: "partially_installed"
        });
      });

      it("should preview of only failed resource insertions on retry", async () => {
        await installAsset(asset._id);

        const res = await previewAssetInstallation(asset._id);
        expect(res).toEqual({
          insertions: [
            {
              _id: "1",
              contents: {
                schema: {}
              },
              module: "module1",
              installation_status: "failed",
              failure_message: "Resource can't be inserted"
            }
          ],
          updations: [],
          deletions: []
        });
      });

      it("should only install failed resources", async () => {
        await installAsset(asset._id);

        const insertSpy = jest.spyOn(operator, "insert").mockImplementation(res => {
          // somehow method toHaveBeenCalledWith displays the wrong result
          expect(res).toEqual({
            _id: "1",
            contents: {schema: {}},
            module: "module1",
            installation_status: "failed",
            failure_message: "Resource can't be inserted"
          });
          return Promise.resolve();
        });
        await installAsset(asset._id);

        expect(insertSpy).toHaveBeenCalledTimes(1);

        const res = await getAsset(asset._id);
        expect(res).toEqual({
          _id: asset._id,
          name: "asset1",
          description: "description1",
          resources: [
            {
              _id: "1",
              contents: {
                schema: {}
              },
              module: "module1",
              installation_status: "installed"
            },
            {
              _id: "2",
              contents: {
                schema: {}
              },
              module: "module1",
              installation_status: "installed"
            }
          ],
          configs: [],
          url: "1",
          icon: "check_circle_outline",
          status: "installed"
        });
      });

      describe("installing new version", () => {
        let assetv2;

        beforeEach(async () => {
          await installAsset(asset._id);

          assetv2 = {
            name: "asset1",
            description: "v2",
            resources: [
              {
                _id: "2",
                contents: {
                  schema: {}
                },
                module: "module1"
              },
              {
                _id: "3",
                contents: {
                  schema: {}
                },
                module: "module1"
              }
            ],
            configs: [],
            url: "1",
            icon: "check_circle_outline"
          };

          assetv2 = await downloadAsset(assetv2);
        });

        it("should not install the new version if another version of the asset with partially_installed status is found", async () => {
          const res = await installAsset(assetv2._id);
          expect(res.statusCode).toEqual(400);
          expect(res.message).toEqual(
            "Found another version of this asset with partially_installed status. Please reinstall or remove that version before install a new one."
          );

          const assets = await getAssets();
          expect(assets).toEqual([
            {
              _id: asset._id,
              name: "asset1",
              description: "description1",
              resources: [
                {
                  _id: "1",
                  contents: {
                    schema: {}
                  },
                  module: "module1",
                  installation_status: "failed",
                  failure_message: "Resource can't be inserted"
                },
                {
                  _id: "2",
                  contents: {
                    schema: {}
                  },
                  module: "module1",
                  installation_status: "installed"
                }
              ],
              configs: [],
              url: "1",
              icon: "check_circle_outline",
              status: "partially_installed"
            },
            {
              _id: assetv2._id,
              name: "asset1",
              description: "v2",
              resources: [
                {
                  _id: "2",
                  contents: {
                    schema: {}
                  },
                  module: "module1"
                },
                {
                  _id: "3",
                  contents: {
                    schema: {}
                  },
                  module: "module1"
                }
              ],
              configs: [],
              url: "1",
              icon: "check_circle_outline",
              status: "downloaded"
            }
          ]);
        });

        it("should install v2 if previous version is installed successfully", async () => {
          operator.insert = () => Promise.resolve();

          await installAsset(asset._id);
          await installAsset(assetv2._id);

          const assets = await getAssets();
          expect(assets).toEqual([
            {
              _id: asset._id,
              name: "asset1",
              description: "description1",
              resources: [
                {
                  _id: "1",
                  contents: {
                    schema: {}
                  },
                  module: "module1"
                },
                {
                  _id: "2",
                  contents: {
                    schema: {}
                  },
                  module: "module1"
                }
              ],
              configs: [],
              url: "1",
              icon: "check_circle_outline",
              status: "downloaded"
            },
            {
              _id: assetv2._id,
              name: "asset1",
              description: "v2",
              resources: [
                {
                  _id: "2",
                  contents: {
                    schema: {}
                  },
                  module: "module1",
                  installation_status: "installed"
                },
                {
                  _id: "3",
                  contents: {
                    schema: {}
                  },
                  module: "module1",
                  installation_status: "installed"
                }
              ],
              configs: [],
              url: "1",
              icon: "check_circle_outline",
              status: "installed"
            }
          ]);
        });

        it("should install v2 if previous version is soft deleted", async () => {
          await deleteAsset(asset._id, "soft");
          await installAsset(assetv2._id);

          const assets = await getAssets();
          expect(assets).toEqual([
            {
              _id: asset._id,
              name: "asset1",
              description: "description1",
              resources: [
                {
                  _id: "1",
                  contents: {
                    schema: {}
                  },
                  module: "module1"
                },
                {
                  _id: "2",
                  contents: {
                    schema: {}
                  },
                  module: "module1"
                }
              ],
              configs: [],
              url: "1",
              icon: "check_circle_outline",
              status: "downloaded"
            },
            {
              _id: assetv2._id,
              name: "asset1",
              description: "v2",
              resources: [
                {
                  _id: "2",
                  contents: {
                    schema: {}
                  },
                  module: "module1",
                  installation_status: "installed"
                },
                {
                  _id: "3",
                  contents: {
                    schema: {}
                  },
                  module: "module1",
                  installation_status: "installed"
                }
              ],
              configs: [],
              url: "1",
              icon: "check_circle_outline",
              status: "installed"
            }
          ]);
        });

        it("should install v2 if previous version is hard deleted", async () => {
          await deleteAsset(asset._id, "hard");
          await installAsset(assetv2._id);

          const assets = await getAssets();
          expect(assets).toEqual([
            {
              _id: assetv2._id,
              name: "asset1",
              description: "v2",
              resources: [
                {
                  _id: "2",
                  contents: {
                    schema: {}
                  },
                  module: "module1",
                  installation_status: "installed"
                },
                {
                  _id: "3",
                  contents: {
                    schema: {}
                  },
                  module: "module1",
                  installation_status: "installed"
                }
              ],
              configs: [],
              url: "1",
              icon: "check_circle_outline",
              status: "installed"
            }
          ]);
        });
      });
    });
  });
});
