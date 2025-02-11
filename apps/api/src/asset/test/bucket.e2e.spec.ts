import {INestApplication, ModuleMetadata} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {AssetModule} from "@spica-server/asset";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import * as os from "os";
import {PreferenceModule} from "@spica-server/preference";

describe("Bucket", () => {
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
        DatabaseTestingModule.replicaSet(),
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
      resources: [bucketv1Resource],
      url: "1"
    };

    assetv2 = {...assetv1, resources: [bucketv2Resource]};

    assetv1 = await downloadAsset(assetv1);
  });

  // separating these tests cause them failed
  it("insert, update and delete", async () => {
    // INSERT PREVIEW
    let preview = await previewAssetInstallation(assetv1._id);

    expect(preview).toEqual({insertions: [bucketv1Resource], updations: [], deletions: []});

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    let buckets = await getBuckets();
    expect(buckets).toEqual([]);

    // INSERT
    await installAsset(assetv1._id);
    buckets = await getBuckets();
    expect(buckets).toEqual([bucketv1]);

    const bucket = await getBucket(bucketId);
    expect(bucket).toEqual(bucketv1);

    // UPDATE PREVIEW
    assetv2 = await downloadAsset(assetv2);

    preview = await previewAssetInstallation(assetv2._id);
    expect(preview).toEqual({insertions: [], updations: [bucketv2Resource], deletions: []});

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("installed");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("downloaded");

    buckets = await getBuckets();
    expect(buckets).toEqual([bucketv1]);

    // UPDATE
    await installAsset(assetv2._id);

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("installed");

    buckets = await getBuckets();
    expect(buckets).toEqual([bucketv2]);

    // DELETE PREVIEW
    let assetv3 = {...assetv2, resources: []};
    delete assetv3._id;
    delete assetv3.status;
    assetv3 = await downloadAsset(assetv3);
    preview = await previewAssetInstallation(assetv3._id);

    expect(preview).toEqual({
      insertions: [],
      updations: [],
      deletions: [{...bucketv2Resource, installation_status: "installed"}]
    });

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("installed");

    assetv3 = await getAsset(assetv3._id);
    expect(assetv3.status).toEqual("downloaded");

    buckets = await getBuckets();
    expect(buckets).toEqual([bucketv2]);

    // DELETE
    await installAsset(assetv3._id);

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("downloaded");

    assetv3 = await getAsset(assetv3._id);
    expect(assetv3.status).toEqual("installed");

    buckets = await getBuckets();
    expect(buckets).toEqual([]);
  });
});
