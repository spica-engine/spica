import {INestApplication, ModuleMetadata} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {AssetModule} from "@spica-server/asset";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import * as os from "os";
import {IdentityModule} from "@spica-server/passport/identity";
import {PolicyModule} from "@spica-server/passport/policy";
import {PreferenceModule} from "@spica-server/preference";

const EXPIRES_IN = 60 * 60 * 24;
const MAX_EXPIRES_IN = EXPIRES_IN * 2;

jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;


describe("identity-settings", () => {
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
      PolicyModule.forRoot(),
      IdentityModule.forRoot({
        expiresIn: EXPIRES_IN,
        issuer: "spica",
        maxExpiresIn: MAX_EXPIRES_IN,
        secretOrKey: "secret"
      }),
      PassportTestingModule.initialize({overriddenStrategyType: "JWT"}),
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

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__skip__" && typeof actual == typeof expected) {
        return true;
      }
    });
  });

  afterEach(() => app.close());

  function getIdentitySettings() {
    return req.get("preference/passport").then(r => r.body);
  }

  let identitySettingsV1Resource;
  let identitySettingsV1;

  let identitySettingsV2Resource;
  let identitySettingsV2;

  let assetv1;
  let assetv2;

  beforeEach(async () => {
    identitySettingsV1 = {
      attributes: {
        name: {
          type: "string"
        }
      }
    };

    identitySettingsV1Resource = {
      _id: "identity",
      module: "preference",
      contents: {
        schema: identitySettingsV1
      }
    };

    identitySettingsV2 = {
      attributes: {
        age: {
          type: "number"
        }
      }
    };

    identitySettingsV2Resource = {
      ...identitySettingsV1Resource,
      contents: {
        schema: identitySettingsV2
      }
    };
  });

  beforeEach(async () => {
    assetv1 = {
      name: "identity settings asset",
      description: "description",
      configs: [],
      resources: [identitySettingsV1Resource],
      url: "1"
    };

    assetv2 = {...assetv1, resources: [identitySettingsV2Resource]};

    assetv1 = await downloadAsset(assetv1);
  });

  it("insert update and delete", async () => {
    // INSERT PREVIEW
    let preview = await previewAssetInstallation(assetv1._id);

    expect(preview).toEqual({
      insertions: [identitySettingsV1Resource],
      updations: [],
      deletions: []
    });

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    let identitySettings = await getIdentitySettings();
    expect(identitySettings).toEqual({
      scope: "passport",
      identity: {attributes: {type: "object"}}
    });

    // INSERT
    await installAsset(assetv1._id);

    identitySettings = await getIdentitySettings();
    expect(identitySettings).toEqual({
      _id: "__skip__",
      scope: "passport",
      identity: identitySettingsV1
    });

    // UPDATE PREVIEW
    assetv2 = await downloadAsset(assetv2);

    preview = await previewAssetInstallation(assetv2._id);
    expect(preview).toEqual({
      insertions: [],
      updations: [identitySettingsV2Resource],
      deletions: []
    });

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("installed");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("downloaded");

    identitySettings = await getIdentitySettings();
    expect(identitySettings).toEqual({
      _id: "__skip__",
      scope: "passport",
      identity: identitySettingsV1
    });

    // UPDATE
    await installAsset(assetv2._id);

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("installed");

    identitySettings = await getIdentitySettings();
    expect(identitySettings).toEqual({
      _id: "__skip__",
      scope: "passport",
      identity: identitySettingsV2
    });

    // DELETE PREVIEW
    let assetv3 = {...assetv2, resources: []};
    delete assetv3._id;
    delete assetv3.status;

    assetv3 = await downloadAsset(assetv3);

    preview = await previewAssetInstallation(assetv3._id);
    expect(preview).toEqual({
      insertions: [],
      updations: [],
      deletions: [{...identitySettingsV2Resource, installation_status: "installed"}]
    });

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("installed");

    assetv3 = await getAsset(assetv3._id);
    expect(assetv3.status).toEqual("downloaded");

    identitySettings = await getIdentitySettings();
    expect(identitySettings).toEqual({
      _id: "__skip__",
      scope: "passport",
      identity: identitySettingsV2
    });

    // DELETE
    await installAsset(assetv3._id);

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("downloaded");

    assetv3 = await getAsset(assetv3._id);
    expect(assetv3.status).toEqual("installed");

    identitySettings = await getIdentitySettings();
    expect(identitySettings).toEqual({
      _id: "__skip__",
      scope: "passport",
      identity: {attributes: {}}
    });
  });
});
