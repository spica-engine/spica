import {INestApplication, ModuleMetadata} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {contractSuite} from "@spica-server/database-testing";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {AssetModule, exporters, operators, validators} from "@spica-server/asset";
import {SchemaModule} from "@spica-server/core-schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core-schema";
import os from "os";
import {PreferenceModule} from "@spica-server/preference";
import {EnvVarModule} from "@spica-server/env_var";
import {withId, idOf, stripId} from "@spica-server/data";

contractSuite("EnvVar", engine => {
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
        PreferenceModule.forRoot(),
        PassportTestingModule.initialize({overriddenStrategyType: "JWT"}),
        SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
        AssetModule.forRoot({persistentPath: os.tmpdir()}),
        EnvVarModule.forRoot({realtime: false})
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    envVarId = String(module.get<IdTypes>(ID_TYPES).forCollection("env_var").generate());

    await app.listen(req.socket);
  });

  afterEach(async () => {
    await app.close();
    validators.clear();
    operators.clear();
    exporters.clear();
  });

  function stripTimestamps({updated_at, ...rest}) {
    return rest;
  }

  function getEnvVars() {
    return req.get("env-var").then(r => r.body.map(stripTimestamps));
  }

  function getEnvVar(id) {
    return req.get(`env-var/${id}`).then(r => stripTimestamps(r.body));
  }

  let envVarv1Resource;
  let envVarv1;
  let envVarId: string;

  let envVarv2Resource;
  let envVarv2;

  let assetv1;
  let assetv2;

  beforeEach(async () => {
    envVarv1 = withId({key: "API_KEY", value: "123"}, envVarId);

    envVarv1Resource = withId(
      {
        module: "env_var",
        contents: {
          schema: envVarv1
        }
      },
      envVarId
    );

    envVarv2 = {...envVarv1, value: "false"};

    envVarv2Resource = {...envVarv1Resource, contents: {schema: envVarv2}};
  });

  beforeEach(async () => {
    assetv1 = {
      name: "env_var asset",
      description: "description",
      configs: [],
      resources: [envVarv1Resource],
      url: "1"
    };

    assetv2 = {...assetv1, resources: [envVarv2Resource]};

    assetv1 = await downloadAsset(assetv1);
  });

  // separating these tests cause them failed
  it("insert, update and delete", async () => {
    // INSERT PREVIEW
    let preview = await previewAssetInstallation(idOf(assetv1));

    expect(preview).toEqual({insertions: [envVarv1Resource], updations: [], deletions: []});

    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("downloaded");

    let envVars = await getEnvVars();
    expect(envVars).toEqual([]);

    // INSERT
    await installAsset(idOf(assetv1));
    envVars = await getEnvVars();
    expect(envVars).toEqual([envVarv1]);

    const envVar = await getEnvVar(envVarId);
    expect(envVar).toEqual(envVarv1);

    // UPDATE PREVIEW
    assetv2 = await downloadAsset(assetv2);

    preview = await previewAssetInstallation(idOf(assetv2));
    expect(preview).toEqual({insertions: [], updations: [envVarv2Resource], deletions: []});

    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("installed");

    assetv2 = await getAsset(idOf(assetv2));
    expect(assetv2.status).toEqual("downloaded");

    envVars = await getEnvVars();
    expect(envVars).toEqual([envVarv1]);

    // UPDATE
    await installAsset(idOf(assetv2));

    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(idOf(assetv2));
    expect(assetv2.status).toEqual("installed");

    envVars = await getEnvVars();
    expect(envVars).toEqual([envVarv2]);

    // DELETE PREVIEW
    let assetv3 = {...assetv2, resources: []};
    stripId(assetv3);
    delete assetv3.status;
    assetv3 = await downloadAsset(assetv3);
    preview = await previewAssetInstallation(idOf(assetv3));

    expect(preview).toEqual({
      insertions: [],
      updations: [],
      deletions: [{...envVarv2Resource, installation_status: "installed"}]
    });

    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(idOf(assetv2));
    expect(assetv2.status).toEqual("installed");

    assetv3 = await getAsset(idOf(assetv3));
    expect(assetv3.status).toEqual("downloaded");

    envVars = await getEnvVars();
    expect(envVars).toEqual([envVarv2]);

    // DELETE
    await installAsset(idOf(assetv3));

    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(idOf(assetv2));
    expect(assetv2.status).toEqual("downloaded");

    assetv3 = await getAsset(idOf(assetv3));
    expect(assetv3.status).toEqual("installed");

    envVars = await getEnvVars();
    expect(envVars).toEqual([]);
  });
});
