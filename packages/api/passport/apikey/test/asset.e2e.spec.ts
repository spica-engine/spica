import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {ApiKeyModule} from "@spica-server/passport-apikey";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {contractSuite} from "@spica-server/database-testing";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {AssetModule, exporters, operators, validators} from "@spica-server/asset";
import {SchemaModule} from "@spica-server/core-schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core-schema";
import os from "os";
import {idOf, stripId, withId} from "@spica-server/data";

contractSuite("Apikey", engine => {
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

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        engine.module(),
        PassportTestingModule.initialize({overriddenStrategyType: "JWT"}),
        SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
        ApiKeyModule.forRoot({realtime: false}),
        AssetModule.forRoot({persistentPath: os.tmpdir()})
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    apikeyId = String(module.get<IdTypes>(ID_TYPES).forCollection("apikey").generate());

    await app.listen(req.socket);
  });

  afterEach(async () => {
    await app.close();
    validators.clear();
    operators.clear();
    exporters.clear();
  });

  function getApikeys() {
    return req.get("passport/apikey").then(r => r.body.data);
  }

  function getApikey(id) {
    return req.get(`passport/apikey/${id}`).then(r => r.body);
  }

  let apikeyv1Resource;
  let apikeyv1;
  let apikeyId: string;

  let apikeyv2Resource;
  let apikeyv2;

  let assetv1;
  let assetv2;

  beforeEach(async () => {
    apikeyv1 = withId(
      {name: "apikey1", key: "secret", description: "desc1", policies: [], active: true},
      apikeyId
    );

    apikeyv1Resource = withId(
      {
        module: "apikey",
        contents: {
          schema: apikeyv1
        }
      },
      apikeyId
    );

    apikeyv2 = {...apikeyv1, policies: ["policy1"]};

    apikeyv2Resource = {...apikeyv1Resource, contents: {schema: apikeyv2}};
  });

  beforeEach(async () => {
    assetv1 = {
      name: "Apikey asset",
      description: "description",
      configs: [],
      resources: [apikeyv1Resource],
      url: "1"
    };

    assetv2 = {...assetv1, resources: [apikeyv2Resource]};

    assetv1 = await downloadAsset(assetv1);
  });

  // separating these tests cause them failed
  it("insert, update and delete", async () => {
    // INSERT PREVIEW
    let preview = await previewAssetInstallation(idOf(assetv1));

    expect(preview).toEqual({insertions: [apikeyv1Resource], updations: [], deletions: []});

    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("downloaded");

    let apikeys = await getApikeys();
    expect(apikeys).toEqual([]);

    // INSERT
    await installAsset(idOf(assetv1));
    apikeys = await getApikeys();
    expect(apikeys).toEqual([apikeyv1]);

    const apikey = await getApikey(apikeyId);
    expect(apikey).toEqual(apikeyv1);

    // UPDATE PREVIEW
    assetv2 = await downloadAsset(assetv2);

    preview = await previewAssetInstallation(idOf(assetv2));
    expect(preview).toEqual({insertions: [], updations: [apikeyv2Resource], deletions: []});

    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("installed");

    assetv2 = await getAsset(idOf(assetv2));
    expect(assetv2.status).toEqual("downloaded");

    apikeys = await getApikeys();
    expect(apikeys).toEqual([apikeyv1]);

    // UPDATE
    await installAsset(idOf(assetv2));
    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(idOf(assetv2));
    expect(assetv2.status).toEqual("installed");

    apikeys = await getApikeys();
    expect(apikeys).toEqual([apikeyv2]);

    // DELETE PREVIEW
    let assetv3 = {...assetv2, resources: []};
    stripId(assetv3);
    delete assetv3.status;
    assetv3 = await downloadAsset(assetv3);
    preview = await previewAssetInstallation(idOf(assetv3));

    expect(preview).toEqual({
      insertions: [],
      updations: [],
      deletions: [{...apikeyv2Resource, installation_status: "installed"}]
    });

    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(idOf(assetv2));
    expect(assetv2.status).toEqual("installed");

    assetv3 = await getAsset(idOf(assetv3));
    expect(assetv3.status).toEqual("downloaded");

    apikeys = await getApikeys();
    expect(apikeys).toEqual([apikeyv2]);

    // DELETE
    await installAsset(idOf(assetv3));

    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(idOf(assetv2));
    expect(assetv2.status).toEqual("downloaded");

    assetv3 = await getAsset(idOf(assetv3));
    expect(assetv3.status).toEqual("installed");

    apikeys = await getApikeys();
    expect(apikeys).toEqual([]);
  });
});
