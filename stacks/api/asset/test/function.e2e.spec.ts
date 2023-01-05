import {INestApplication, ModuleMetadata} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {ReplicationTestingModule} from "@spica-server/replication/testing";
import {AssetModule} from "@spica-server/asset";
import {FunctionModule} from "@spica-server/function";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import * as os from "os";
import {PreferenceModule} from "@spica-server/preference";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:45670";

describe("function", () => {
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

  let req: Request;
  let app: INestApplication;

  const moduleMeta: ModuleMetadata = {
    imports: [
      CoreTestingModule,
      DatabaseTestingModule.replicaSet(),
      PreferenceModule.forRoot(),
      PassportTestingModule.initialize({overriddenStrategyType: "JWT"}),
      SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
      AssetModule.forRoot({persistentPath: os.tmpdir()}),
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

    await new Promise((resolve, _) => setTimeout(resolve, 3000));

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__skip__" && typeof actual == typeof expected) {
        return true;
      }
    });
  }, 10_000);

  function getFns() {
    return req.get("function").then(r => r.body);
  }

  function getFn(id) {
    return req.get(`function/${id}`).then(r => r.body);
  }

  function getFnIndex(id) {
    return req.get(`function/${id}/index`).then(r => r.body);
  }

  let fnv1Resource;
  let fnv1;
  const fnId = new ObjectId().toString();

  let fnv2Resource;
  let fnv2;

  let assetv1;
  let assetv2;

  beforeEach(async () => {
    fnv1 = {
      _id: fnId,
      name: "function",
      env: {
        test: "123"
      },
      timeout: 120,
      language: "javascript",
      triggers: {
        test: {
          type: "http",
          active: false,
          options: {
            method: "Get",
            path: "/",
            preflight: true
          }
        }
      },
      memoryLimit: 100
    };

    fnv1Resource = {
      _id: fnId,
      module: "function",
      contents: {
        schema: fnv1,
        env: {
          test: "987"
        },
        index: "console.log('Hi')",
        package: {
          dependencies: {}
        }
      }
    };

    fnv2 = {...fnv1, timeout: 60};

    fnv2Resource = {
      ...fnv1Resource,
      contents: {
        schema: fnv2,
        env: {asd: "qwe"},
        index: "console.log('Hi v2')",
        package: {
          dependencies: {}
        }
      }
    };
  });

  beforeEach(async () => {
    assetv1 = {
      name: "fn asset",
      description: "description",
      configs: [],
      resources: [fnv1Resource],
      url: "1"
    };

    assetv2 = {...assetv1, resources: [fnv2Resource]};

    assetv1 = await downloadAsset(assetv1);
  });

  it("should insert, update and delete", async () => {
    // INSERT PREVIEW
    let preview = await previewAssetInstallation(assetv1._id);

    expect(preview).toEqual({insertions: [fnv1Resource], updations: [], deletions: []});

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    let fns = await getFns();
    expect(fns).toEqual([]);

    // INSERT
    await installAsset(assetv1._id);

    fns = await getFns();
    expect(fns).toEqual([fnv1]);

    let fn = await getFn(fnId);
    expect(fn).toEqual(fn);

    // UPDATE PREVIEW
    assetv2 = await downloadAsset(assetv2);
    preview = await previewAssetInstallation(assetv2._id);
    expect(preview).toEqual({insertions: [], updations: [fnv2Resource], deletions: []});

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("installed");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("downloaded");

    fns = await getFns();
    expect(fns).toEqual([fnv1]);

    // UPDATE
    const res = await installAsset(assetv2._id);
    console.dir(res, {depth: Infinity});
    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("installed");

    fns = await getFns();
    expect(fns).toEqual([fnv2]);

    // DELETE PREVIEW
    let assetv3 = {...assetv2, resources: []};
    delete assetv3._id;
    delete assetv3.status;

    assetv3 = await downloadAsset(assetv3);

    preview = await previewAssetInstallation(assetv3._id);
    expect(preview).toEqual({insertions: [], updations: [], deletions: [fnv2Resource]});

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("installed");

    assetv3 = await getAsset(assetv3._id);
    expect(assetv3.status).toEqual("downloaded");

    fns = await getFns();
    expect(fns).toEqual([fnv2]);

    // DELETE
    await installAsset(assetv3._id);

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("downloaded");

    assetv3 = await getAsset(assetv3._id);
    expect(assetv3.status).toEqual("installed");

    fns = await getFns();
    expect(fns).toEqual([]);
  });

  // describe("insertions", () => {
  //   it("should preview function asset installation", async () => {
  //     const preview = await previewAssetInstallation(assetv1._id);

  //     expect(preview).toEqual({insertions: [fnv1Resource], updations: [], deletions: []});

  //     assetv1 = await getAsset(assetv1._id);
  //     expect(assetv1.status).toEqual("downloaded");

  //     const fns = await getFns();
  //     expect(fns).toEqual([]);
  //   });

  //   it("should install function asset", async () => {
  //     await installAsset(assetv1._id);

  //     const fns = await getFns();
  //     expect(fns).toEqual([fnv1]);

  //     const fn = await getFn(fnId);
  //     expect(fn).toEqual(fn);
  //   });
  // });

  // describe("updations", () => {
  //   beforeEach(async () => {
  //     await installAsset(assetv1._id);
  //     assetv2 = await downloadAsset(assetv2);
  //   });

  //   it("should preview function asset installation", async () => {
  //     const preview = await previewAssetInstallation(assetv2._id);
  //     expect(preview).toEqual({insertions: [], updations: [fnv2Resource], deletions: []});

  //     assetv1 = await getAsset(assetv1._id);
  //     expect(assetv1.status).toEqual("installed");

  //     assetv2 = await getAsset(assetv2._id);
  //     expect(assetv2.status).toEqual("downloaded");

  //     const fns = await getFns();
  //     expect(fns).toEqual([fnv1]);
  //   });

  //   it("should install function asset", async () => {
  //     await installAsset(assetv2._id);
  //     assetv1 = await getAsset(assetv1._id);
  //     expect(assetv1.status).toEqual("downloaded");

  //     assetv2 = await getAsset(assetv2._id);
  //     expect(assetv2.status).toEqual("installed");

  //     const fns = await getFns();
  //     expect(fns).toEqual([fnv2]);
  //   });
  // });

  // xdescribe("deletions", () => {
  //   beforeEach(async () => {
  //     await installAsset(assetv1._id);

  //     assetv2 = {...assetv1, resources: []};
  //     delete assetv2._id;
  //     delete assetv2.status;

  //     assetv2 = await downloadAsset(assetv2);
  //   });

  //   it("should preview function asset installation", async () => {
  //     const preview = await previewAssetInstallation(assetv2._id);
  //     expect(preview).toEqual({insertions: [], updations: [], deletions: [fnv1Resource]});

  //     assetv1 = await getAsset(assetv1._id);
  //     expect(assetv1.status).toEqual("installed");

  //     assetv2 = await getAsset(assetv2._id);
  //     expect(assetv2.status).toEqual("downloaded");

  //     const fns = await getFns();
  //     expect(fns).toEqual([fnv1]);
  //   });

  //   it("should install function asset", async () => {
  //     await installAsset(assetv2._id);

  //     assetv1 = await getAsset(assetv1._id);
  //     expect(assetv1.status).toEqual("downloaded");

  //     assetv2 = await getAsset(assetv2._id);
  //     expect(assetv2.status).toEqual("installed");

  //     const fns = await getFns();
  //     expect(fns).toEqual([]);
  //   });
  // });
});
