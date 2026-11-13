import {INestApplication, ModuleMetadata} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {contractSuite} from "@spica-server/database-testing";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {keyed} from "./support/bucket-app";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {AssetModule, exporters, operators, validators} from "@spica-server/asset";
import {SchemaModule} from "@spica-server/core-schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core-schema";
import os from "os";
import {PreferenceModule} from "@spica-server/preference";
import {idOf, stripId, systemKeyField} from "@spica-server/data";

contractSuite("Bucket", engine => {
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
    validators.clear();
    operators.clear();
    exporters.clear();

    const module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        engine.module(),
        PreferenceModule.forRoot(),
        PassportTestingModule.initialize({overriddenStrategyType: "JWT"}),
        SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
        BucketModule.forRoot({
          hooks: false,
          history: false,
          realtime: false,
          cache: false,
          graphql: false
        }),
        AssetModule.forRoot({persistentPath: os.tmpdir()})
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    bucketId = String(module.get<IdTypes>(ID_TYPES).unscoped().generate());

    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  function getBuckets() {
    return req.get("bucket").then(r => r.body);
  }

  function getBucket(id) {
    return req.get(`bucket/${id}`).then(r => r.body);
  }

  let bucketv1Resource;
  let bucketv1;
  let bucketId: string;

  let bucketv2Resource;
  let bucketv2;

  let assetv1;
  let assetv2;

  beforeEach(async () => {
    bucketv1 = {
      [systemKeyField()]: bucketId,
      title: "my_bucket",
      description: "description",
      acl: {
        write: "true==true",
        read: "true==true"
      },
      ...keyed(engine, {name: {type: "string"}}),
      history: false,
      icon: "view_stream"
    };

    bucketv1Resource = {
      [systemKeyField()]: bucketId,
      module: "bucket",
      contents: {
        schema: bucketv1
      }
    };

    bucketv2 = {...bucketv1, ...keyed(engine, {title: {type: "string"}})};

    bucketv2Resource = {...bucketv1Resource, contents: {schema: bucketv2}};
  });

  beforeEach(async () => {
    assetv1 = {
      name: "bucket asset",
      description: "description",
      configs: [],
      resources: [bucketv1Resource],
      url: "1"
    };

    assetv2 = {...assetv1, resources: [bucketv2Resource]};

    assetv1 = await downloadAsset(assetv1);
  });

  // separating these tests cause them failed
  it("insert, update and delete", async () => {
    // INSERT PREVIEW
    let preview = await previewAssetInstallation(idOf(assetv1));

    expect(preview).toEqual({insertions: [bucketv1Resource], updations: [], deletions: []});

    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("downloaded");

    let buckets = await getBuckets();
    expect(buckets).toEqual([]);

    // INSERT
    await installAsset(idOf(assetv1));
    buckets = await getBuckets();
    expect(buckets).toEqual([bucketv1]);

    const bucket = await getBucket(bucketId);
    expect(bucket).toEqual(bucketv1);

    // UPDATE PREVIEW
    assetv2 = await downloadAsset(assetv2);

    preview = await previewAssetInstallation(idOf(assetv2));
    expect(preview).toEqual({insertions: [], updations: [bucketv2Resource], deletions: []});

    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("installed");

    assetv2 = await getAsset(idOf(assetv2));
    expect(assetv2.status).toEqual("downloaded");

    buckets = await getBuckets();
    expect(buckets).toEqual([bucketv1]);

    // UPDATE
    await installAsset(idOf(assetv2));

    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(idOf(assetv2));
    expect(assetv2.status).toEqual("installed");

    buckets = await getBuckets();
    expect(buckets).toEqual([bucketv2]);

    // DELETE PREVIEW
    let assetv3 = {...assetv2, resources: []};
    stripId(assetv3);
    delete assetv3.status;
    assetv3 = await downloadAsset(assetv3);
    preview = await previewAssetInstallation(idOf(assetv3));

    expect(preview).toEqual({
      insertions: [],
      updations: [],
      deletions: [{...bucketv2Resource, installation_status: "installed"}]
    });

    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(idOf(assetv2));
    expect(assetv2.status).toEqual("installed");

    assetv3 = await getAsset(idOf(assetv3));
    expect(assetv3.status).toEqual("downloaded");

    buckets = await getBuckets();
    expect(buckets).toEqual([bucketv2]);

    // DELETE
    await installAsset(idOf(assetv3));

    assetv1 = await getAsset(idOf(assetv1));
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(idOf(assetv2));
    expect(assetv2.status).toEqual("downloaded");

    assetv3 = await getAsset(idOf(assetv3));
    expect(assetv3.status).toEqual("installed");

    buckets = await getBuckets();
    expect(buckets).toEqual([]);
  });
});
