import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {DashboardModule} from "@spica-server/dashboard";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {AssetModule} from "@spica-server/asset";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import os from "os";

describe("Dashboard", () => {
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
        PassportTestingModule.initialize({overriddenStrategyType: "JWT"}),
        SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
        DashboardModule.forRoot({realtime: false}),
        AssetModule.forRoot({persistentPath: os.tmpdir()})
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);

    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  function getDashboards() {
    return req.get("dashboard").then(r => r.body);
  }

  function getDashboard(id) {
    return req.get(`dashboard/${id}`).then(r => r.body);
  }

  let dashboardv1Resource;
  let dashboardv1;
  const dashboardId = new ObjectId().toString();

  let dashboardv2Resource;
  let dashboardv2;

  let assetv1;
  let assetv2;

  beforeEach(async () => {
    dashboardv1 = {
      _id: dashboardId,
      name: "dashboard1",
      icon: "icon1",
      components: [{name: "component1", url: "url1", type: "line"}]
    };

    dashboardv1Resource = {
      _id: dashboardId,
      module: "dashboard",
      contents: {
        schema: dashboardv1
      }
    };

    dashboardv2 = {...dashboardv1, components: [{...dashboardv1.components[0], type: "bar"}]};

    dashboardv2Resource = {...dashboardv1Resource, contents: {schema: dashboardv2}};
  });

  beforeEach(async () => {
    assetv1 = {
      name: "Dashboard asset",
      description: "description",
      configs: [],
      resources: [dashboardv1Resource],
      url: "1"
    };

    assetv2 = {...assetv1, resources: [dashboardv2Resource]};

    assetv1 = await downloadAsset(assetv1);
  });

  // separating these tests cause them failed
  it("insert, update and delete", async () => {
    // INSERT PREVIEW
    let preview = await previewAssetInstallation(assetv1._id);

    expect(preview).toEqual({insertions: [dashboardv1Resource], updations: [], deletions: []});

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    let dashboards = await getDashboards();
    expect(dashboards).toEqual([]);

    // INSERT
    await installAsset(assetv1._id);
    dashboards = await getDashboards();
    expect(dashboards).toEqual([dashboardv1]);

    const dashboard = await getDashboard(dashboardId);
    expect(dashboard).toEqual(dashboardv1);

    // UPDATE PREVIEW
    assetv2 = await downloadAsset(assetv2);

    preview = await previewAssetInstallation(assetv2._id);
    expect(preview).toEqual({insertions: [], updations: [dashboardv2Resource], deletions: []});

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("installed");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("downloaded");

    dashboards = await getDashboards();
    expect(dashboards).toEqual([dashboardv1]);

    // UPDATE
    await installAsset(assetv2._id);
    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("installed");

    dashboards = await getDashboards();
    expect(dashboards).toEqual([dashboardv2]);

    // DELETE PREVIEW
    let assetv3 = {...assetv2, resources: []};
    delete assetv3._id;
    delete assetv3.status;
    assetv3 = await downloadAsset(assetv3);
    preview = await previewAssetInstallation(assetv3._id);

    expect(preview).toEqual({
      insertions: [],
      updations: [],
      deletions: [{...dashboardv2Resource, installation_status: "installed"}]
    });

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("installed");

    assetv3 = await getAsset(assetv3._id);
    expect(assetv3.status).toEqual("downloaded");

    dashboards = await getDashboards();
    expect(dashboards).toEqual([dashboardv2]);

    // DELETE
    await installAsset(assetv3._id);

    assetv1 = await getAsset(assetv1._id);
    expect(assetv1.status).toEqual("downloaded");

    assetv2 = await getAsset(assetv2._id);
    expect(assetv2.status).toEqual("downloaded");

    assetv3 = await getAsset(assetv3._id);
    expect(assetv3.status).toEqual("installed");

    dashboards = await getDashboards();
    expect(dashboards).toEqual([]);
  });
});
