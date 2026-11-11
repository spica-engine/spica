import {INestApplication, ModuleMetadata} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request, getFreeAddress} from "@spica-server/core-testing";
import {contractSuite} from "@spica-server/database-testing";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {AssetModule, exporters, operators, registrar, validators} from "@spica-server/asset";
import {SchemaModule} from "@spica-server/core-schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core-schema";
import os from "os";
import {idOf, stripId, withId} from "@spica-server/data";

contractSuite("E2E Tests", engine => {
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

  const filterOn = (field: string, value: string) =>
    engine.name == "postgresql"
      ? `document.${field} == '${value}'`
      : JSON.stringify({[field]: value});

  let req: Request;
  let app: INestApplication;

  const moduleMeta: ModuleMetadata = {
    imports: [
      CoreTestingModule,
      engine.module(),
      PassportTestingModule.initialize({overriddenStrategyType: "identity"}),
      SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
      AssetModule.forRoot({persistentPath: os.tmpdir()})
    ]
  };

  beforeEach(async () => {
    process.env.FUNCTION_GRPC_ADDRESS = await getFreeAddress();
    const module = await Test.createTestingModule(moduleMeta).compile();

    app = module.createNestApplication();
    req = module.get(Request);

    await app.listen(req.socket);

    await new Promise((resolve, _) => setTimeout(resolve, 3000));

    const token = await req
      .post("/passport/identify", {identifier: "spica", password: "spica"})
      .then(r => r.body.token);
    req.setDefaultHeaders({Authorization: `IDENTITY ${token}`});
  });

  afterEach(() => app.close());

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
        installed = await installAsset(idOf(installed));

        failed = await downloadAsset(failed);
        await installAsset(idOf(failed));
      });

      it("should get asset1", async () => {
        const assets = await req
          .get("/asset", {filter: filterOn("name", "asset1")})
          .then(r => r.body);
        expect(assets).toEqual([
          withId(
            {
              name: "asset1",
              description: "description1",
              resources: [],
              configs: [],
              status: "downloaded",
              url: "1",
              icon: "check_circle_outline"
            },
            idOf(downloaded)
          )
        ]);
      });

      it("should get downlaoded assets", async () => {
        const assets = await req
          .get("asset", {filter: filterOn("status", "downloaded")})
          .then(r => r.body);
        expect(assets).toEqual([
          withId(
            {
              name: "asset1",
              description: "description1",
              resources: [],
              configs: [],
              status: "downloaded",
              url: "1",
              icon: "check_circle_outline"
            },
            idOf(downloaded)
          ),
          withId(
            {
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
            },
            idOf(failed)
          )
        ]);
      });

      it("should get installed assets", async () => {
        const assets = await req
          .get("asset", {filter: filterOn("status", "installed")})
          .then(r => r.body);
        expect(assets).toEqual([
          withId(
            {
              name: "assetv2",
              description: "description2",
              resources: [],
              configs: [],
              status: "installed",
              url: "2",
              icon: "check_circle_outline"
            },
            idOf(installed)
          )
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
        expect(res.body).toEqual(
          withId(
            {
              name: "asset1",
              description: "desc1",
              resources: [],
              configs: [],
              status: "downloaded",
              url: "1",
              icon: "check_circle_outline"
            },
            idOf(res.body)
          )
        );
      });

      it("should throw error for additional properties", async () => {
        const res = await req.post("asset", {...asset, reject: "me"});

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toEqual("must NOT have additional properties 'reject'");
      });

      it("should throw error for missing required properties", async () => {
        delete asset.name;

        const res = await req.post("asset", asset);

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toEqual(" must have required property 'name'");
      });

      it("should throw error for wrong typed properties", async () => {
        asset.description = 1000;

        const res = await req.post("asset", asset);

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toEqual(".description must be string");
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
        const res = await req.post(`asset/${idOf(asset)}`, {configs: []});

        expect(res.statusCode).toEqual(201);
        expect(res.body).toEqual(
          withId(
            {
              name: "asset1",
              description: "desc1",
              resources: [],
              configs: [],
              status: "installed",
              url: "1",
              icon: "check_circle_outline"
            },
            idOf(res.body)
          )
        );
      });

      it("should preview asset installation", async () => {
        const res = await req.post(`asset/${idOf(asset)}`, {configs: []}, {}, {preview: true});

        expect(res.statusCode).toEqual(201);
        expect(res.body).toEqual({
          insertions: [],
          updations: [],
          deletions: []
        });

        asset = await getAsset(idOf(asset));
        expect(asset).toEqual(
          withId(
            {
              name: "asset1",
              description: "desc1",
              resources: [],
              configs: [],
              status: "downloaded",
              url: "1",
              icon: "check_circle_outline"
            },
            idOf(asset)
          )
        );
      });

      it("asset update asset from v1 to v2", async () => {
        let assetv2 = {
          ...asset,
          description: "v2"
        };
        stripId(assetv2);
        delete assetv2.status;

        assetv2 = await downloadAsset(assetv2);

        await installAsset(idOf(asset));

        let assets = await getAssets();
        expect(assets).toEqual([
          withId(
            {
              name: "asset1",
              description: "desc1",
              configs: [],
              resources: [],
              status: "installed",
              url: "1",
              icon: "check_circle_outline"
            },
            idOf(asset)
          ),
          withId(
            {
              name: "asset1",
              description: "v2",
              configs: [],
              resources: [],
              status: "downloaded",
              url: "1",
              icon: "check_circle_outline"
            },
            idOf(assetv2)
          )
        ]);

        await installAsset(idOf(assetv2));

        assets = await getAssets();
        expect(assets).toEqual([
          withId(
            {
              name: "asset1",
              description: "desc1",
              configs: [],
              resources: [],
              status: "downloaded",
              url: "1",
              icon: "check_circle_outline"
            },
            idOf(asset)
          ),
          withId(
            {
              name: "asset1",
              description: "v2",
              configs: [],
              resources: [],
              status: "installed",
              url: "1",
              icon: "check_circle_outline"
            },
            idOf(assetv2)
          )
        ]);
      });

      describe("errors", () => {
        it("should throw error if asset does not exist", async () => {
          const missing = app.get<IdTypes>(ID_TYPES).forCollection("asset").generate();
          const res = await req.post(`asset/${missing}`, {configs: []});
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

          stripId(asset);
          delete asset.status;

          asset = await downloadAsset(asset);
          const res = await req.post(`asset/${idOf(asset)}`, {configs: []});

          expect(res.statusCode).toEqual(400);
          expect(res.body.message).toEqual(
            "Validation has been failed: Unknown module named 'non_exist_module'."
          );

          const existing = await getAsset(idOf(asset));
          expect(existing).toEqual(
            withId(
              {
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
              },
              idOf(asset)
            )
          );
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
        await installAsset(idOf(asset));
      });

      it("should soft delete the asset as default", async () => {
        const res = await req.delete(`asset/${idOf(asset)}`);
        expect(res.statusCode).toEqual(204);
        expect(res.body).toEqual(undefined);

        asset = await getAsset(idOf(asset));
        expect(asset).toEqual(
          withId(
            {
              name: "asset",
              description: "desc",
              resources: [],
              configs: [],
              status: "downloaded",
              url: "1",
              icon: "check_circle_outline"
            },
            idOf(asset)
          )
        );
      });

      it("should hard delete the asset", async () => {
        let res = await req.request({
          path: `asset/${idOf(asset)}`,
          method: "DELETE",
          query: {type: "hard"}
        });
        expect(res.statusCode).toEqual(204);
        expect(res.body).toEqual(undefined);

        res = await req.get(`asset/${idOf(asset)}`);
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
          withId(
            {
              contents: {
                schema: {}
              },
              module: "module1"
            },
            "1"
          )
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
        const res = await installAsset(idOf(asset));

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
        const res = await previewAssetInstallation(idOf(asset));

        expect(res).toEqual({
          insertions: [
            withId(
              {
                contents: {
                  schema: {}
                },
                module: "module1"
              },
              "1"
            )
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
        await installAsset(idOf(asset));

        const res = await getAsset(idOf(asset));
        expect(res).toEqual(
          withId(
            {
              name: "asset1",
              description: "description1",
              resources: [
                withId(
                  {
                    contents: {
                      schema: {}
                    },
                    module: "module1",
                    installation_status: "installed"
                  },
                  "1"
                )
              ],
              configs: [],
              url: "1",
              icon: "check_circle_outline",
              status: "installed"
            },
            idOf(asset)
          )
        );
      });
    });

    describe("partially installed", () => {
      let operator;
      beforeEach(async () => {
        asset.resources.push(
          withId(
            {
              contents: {
                schema: {}
              },
              module: "module1"
            },
            "2"
          )
        );
        asset = await downloadAsset(asset);

        const validator = async () => await Promise.resolve();
        registrar.validator("module1", validator);

        operator = {
          insert: r =>
            idOf(r).toString() != "1"
              ? Promise.resolve()
              : Promise.reject("Resource can't be inserted"),
          update: () => Promise.resolve(),
          delete: () => Promise.resolve()
        };
        registrar.operator("module1", operator);
      });

      it("should keep installing even if there is failed resource installation", async () => {
        await installAsset(idOf(asset));

        const res = await getAsset(idOf(asset));
        expect(res).toEqual(
          withId(
            {
              name: "asset1",
              description: "description1",
              resources: [
                withId(
                  {
                    contents: {
                      schema: {}
                    },
                    module: "module1",
                    installation_status: "failed",
                    failure_message: "Resource can't be inserted"
                  },
                  "1"
                ),
                withId(
                  {
                    contents: {
                      schema: {}
                    },
                    module: "module1",
                    installation_status: "installed"
                  },
                  "2"
                )
              ],
              configs: [],
              url: "1",
              icon: "check_circle_outline",
              status: "partially_installed"
            },
            idOf(asset)
          )
        );
      });

      it("should preview of only failed resource insertions on retry", async () => {
        await installAsset(idOf(asset));

        const res = await previewAssetInstallation(idOf(asset));
        expect(res).toEqual({
          insertions: [
            withId(
              {
                contents: {
                  schema: {}
                },
                module: "module1",
                installation_status: "failed",
                failure_message: "Resource can't be inserted"
              },
              "1"
            )
          ],
          updations: [],
          deletions: []
        });
      });

      it("should only install failed resources", async () => {
        await installAsset(idOf(asset));

        const insertSpy = jest.spyOn(operator, "insert").mockImplementation(res => {
          // somehow method toHaveBeenCalledWith displays the wrong result
          expect(res).toEqual(
            withId(
              {
                contents: {schema: {}},
                module: "module1",
                installation_status: "failed",
                failure_message: "Resource can't be inserted"
              },
              "1"
            )
          );
          return Promise.resolve();
        });
        await installAsset(idOf(asset));

        expect(insertSpy).toHaveBeenCalledTimes(1);

        const res = await getAsset(idOf(asset));
        expect(res).toEqual(
          withId(
            {
              name: "asset1",
              description: "description1",
              resources: [
                withId(
                  {
                    contents: {
                      schema: {}
                    },
                    module: "module1",
                    installation_status: "installed"
                  },
                  "1"
                ),
                withId(
                  {
                    contents: {
                      schema: {}
                    },
                    module: "module1",
                    installation_status: "installed"
                  },
                  "2"
                )
              ],
              configs: [],
              url: "1",
              icon: "check_circle_outline",
              status: "installed"
            },
            idOf(asset)
          )
        );
      });

      describe("installing new version", () => {
        let assetv2;

        beforeEach(async () => {
          await installAsset(idOf(asset));

          assetv2 = {
            name: "asset1",
            description: "v2",
            resources: [
              withId(
                {
                  contents: {
                    schema: {}
                  },
                  module: "module1"
                },
                "2"
              ),
              withId(
                {
                  contents: {
                    schema: {}
                  },
                  module: "module1"
                },
                "3"
              )
            ],
            configs: [],
            url: "1",
            icon: "check_circle_outline"
          };

          assetv2 = await downloadAsset(assetv2);
        });

        it("should not install the new version if another version of the asset with partially_installed status is found", async () => {
          const res = await installAsset(idOf(assetv2));
          expect(res.statusCode).toEqual(400);
          expect(res.message).toEqual(
            "Found another version of this asset with partially_installed status. Please reinstall or remove that version before install a new one."
          );

          const assets = await getAssets();
          expect(assets).toEqual([
            withId(
              {
                name: "asset1",
                description: "description1",
                resources: [
                  withId(
                    {
                      contents: {
                        schema: {}
                      },
                      module: "module1",
                      installation_status: "failed",
                      failure_message: "Resource can't be inserted"
                    },
                    "1"
                  ),
                  withId(
                    {
                      contents: {
                        schema: {}
                      },
                      module: "module1",
                      installation_status: "installed"
                    },
                    "2"
                  )
                ],
                configs: [],
                url: "1",
                icon: "check_circle_outline",
                status: "partially_installed"
              },
              idOf(asset)
            ),
            withId(
              {
                name: "asset1",
                description: "v2",
                resources: [
                  withId(
                    {
                      contents: {
                        schema: {}
                      },
                      module: "module1"
                    },
                    "2"
                  ),
                  withId(
                    {
                      contents: {
                        schema: {}
                      },
                      module: "module1"
                    },
                    "3"
                  )
                ],
                configs: [],
                url: "1",
                icon: "check_circle_outline",
                status: "downloaded"
              },
              idOf(assetv2)
            )
          ]);
        });

        it("should install v2 if previous version is installed successfully", async () => {
          operator.insert = () => Promise.resolve();

          await installAsset(idOf(asset));
          await installAsset(idOf(assetv2));

          const assets = await getAssets();
          expect(assets).toEqual([
            withId(
              {
                name: "asset1",
                description: "description1",
                resources: [
                  withId(
                    {
                      contents: {
                        schema: {}
                      },
                      module: "module1"
                    },
                    "1"
                  ),
                  withId(
                    {
                      contents: {
                        schema: {}
                      },
                      module: "module1"
                    },
                    "2"
                  )
                ],
                configs: [],
                url: "1",
                icon: "check_circle_outline",
                status: "downloaded"
              },
              idOf(asset)
            ),
            withId(
              {
                name: "asset1",
                description: "v2",
                resources: [
                  withId(
                    {
                      contents: {
                        schema: {}
                      },
                      module: "module1",
                      installation_status: "installed"
                    },
                    "2"
                  ),
                  withId(
                    {
                      contents: {
                        schema: {}
                      },
                      module: "module1",
                      installation_status: "installed"
                    },
                    "3"
                  )
                ],
                configs: [],
                url: "1",
                icon: "check_circle_outline",
                status: "installed"
              },
              idOf(assetv2)
            )
          ]);
        });

        it("should install v2 if previous version is soft deleted", async () => {
          await deleteAsset(idOf(asset), "soft");
          await installAsset(idOf(assetv2));

          const assets = await getAssets();
          expect(assets).toEqual([
            withId(
              {
                name: "asset1",
                description: "description1",
                resources: [
                  withId(
                    {
                      contents: {
                        schema: {}
                      },
                      module: "module1"
                    },
                    "1"
                  ),
                  withId(
                    {
                      contents: {
                        schema: {}
                      },
                      module: "module1"
                    },
                    "2"
                  )
                ],
                configs: [],
                url: "1",
                icon: "check_circle_outline",
                status: "downloaded"
              },
              idOf(asset)
            ),
            withId(
              {
                name: "asset1",
                description: "v2",
                resources: [
                  withId(
                    {
                      contents: {
                        schema: {}
                      },
                      module: "module1",
                      installation_status: "installed"
                    },
                    "2"
                  ),
                  withId(
                    {
                      contents: {
                        schema: {}
                      },
                      module: "module1",
                      installation_status: "installed"
                    },
                    "3"
                  )
                ],
                configs: [],
                url: "1",
                icon: "check_circle_outline",
                status: "installed"
              },
              idOf(assetv2)
            )
          ]);
        });

        it("should install v2 if previous version is hard deleted", async () => {
          await deleteAsset(idOf(asset), "hard");
          await installAsset(idOf(assetv2));

          const assets = await getAssets();
          expect(assets).toEqual([
            withId(
              {
                name: "asset1",
                description: "v2",
                resources: [
                  withId(
                    {
                      contents: {
                        schema: {}
                      },
                      module: "module1",
                      installation_status: "installed"
                    },
                    "2"
                  ),
                  withId(
                    {
                      contents: {
                        schema: {}
                      },
                      module: "module1",
                      installation_status: "installed"
                    },
                    "3"
                  )
                ],
                configs: [],
                url: "1",
                icon: "check_circle_outline",
                status: "installed"
              },
              idOf(assetv2)
            )
          ]);
        });
      });
    });
  });
});
