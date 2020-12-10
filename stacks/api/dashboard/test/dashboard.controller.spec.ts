import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DashboardModule} from "@spica-server/dashboard";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";

describe("DashboardController", () => {
  let request: Request;
  let app: INestApplication;

  const dashboard = {
    name: "First Dashboard",
    icon: "offline_bolt",
    components: [
      {
        name: "chart1",
        url: "test_url"
      },
      {
        name: "chart2",
        url: "test_url"
      }
    ]
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DashboardModule,
        DatabaseTestingModule.standalone()
      ]
    }).compile();

    request = module.get(Request);

    app = module.createNestApplication();

    await app.listen(request.socket);

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__skip__" && typeof actual == typeof expected) {
        return true;
      }
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("should insert a dashboard", async () => {
    const response = await request.post("/dashboard", dashboard);

    expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);
    expect(response.body).toEqual({
      _id: "__skip__",
      name: "First Dashboard",
      icon: "offline_bolt",
      components: [
        {
          name: "chart1",
          url: "test_url"
        },
        {
          name: "chart2",
          url: "test_url"
        }
      ]
    });
  });

  it("should get all dashboards", async () => {
    const {body: insertedDashboard} = await request.post("/dashboard", dashboard);

    const response = await request.get("/dashboard");

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        _id: insertedDashboard._id,
        name: "First Dashboard",
        icon: "offline_bolt",
        components: [
          {
            name: "chart1",
            url: "test_url"
          },
          {
            name: "chart2",
            url: "test_url"
          }
        ]
      }
    ]);
  });

  it("should get specific dashboard", async () => {
    const {body: insertedDashboard} = await request.post("/dashboard", dashboard);

    const response = await request.get(`/dashboard/${insertedDashboard._id}`);

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual({
      _id: insertedDashboard._id,
      name: "First Dashboard",
      icon: "offline_bolt",
      components: [
        {
          name: "chart1",
          url: "test_url"
        },
        {
          name: "chart2",
          url: "test_url"
        }
      ]
    });
  });

  it("should update dashboard", async () => {
    let {body: insertedDashboard} = await request.post("/dashboard", dashboard);

    insertedDashboard.name = "Updated name";

    const response = await request.put(`/dashboard/${insertedDashboard._id}`, insertedDashboard);

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual({
      _id: insertedDashboard._id,
      name: "Updated name",
      icon: "offline_bolt",
      components: [
        {
          name: "chart1",
          url: "test_url"
        },
        {
          name: "chart2",
          url: "test_url"
        }
      ]
    });
  });

  it("should delete dashboard", async () => {
    const {body: insertedDashboard} = await request.post("/dashboard", dashboard);

    const response = await request.delete(`/dashboard/${insertedDashboard._id}`);

    expect([response.statusCode, response.statusText]).toEqual([204, "No Content"]);

    const {body: dashboards} = await request.get("/dashboard");
    expect(dashboards).toEqual([]);
  });
});
