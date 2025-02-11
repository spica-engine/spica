import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DashboardModule} from "@spica-server/dashboard";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";

describe("DashboardController", () => {
  let request: Request;
  let app: INestApplication;

  const dashboard = {
    name: "First Dashboard",
    icon: "offline_bolt",
    components: [
      {
        name: "chart1",
        url: "https://spica.internal",
        type: "line"
      },
      {
        name: "chart2",
        url: "https://spica.internal",
        type: "pie",
        ratio: "1/1"
      }
    ]
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DashboardModule.forRoot(),
        DatabaseTestingModule.standalone(),
        SchemaModule.forRoot({
          formats: [OBJECT_ID]
        })
      ]
    }).compile();

    request = module.get(Request);

    app = module.createNestApplication();

    await app.listen(request.socket);
  });

  afterEach(async () => {
    await app.close();
  });

  it("should insert a dashboard", async () => {
    const response = await request.post("/dashboard", dashboard);

    expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);
    expect(response.body).toEqual({
      _id: response.body._id,
      name: "First Dashboard",
      icon: "offline_bolt",
      components: [
        {
          name: "chart1",
          url: "https://spica.internal",
          type: "line",
          // should set the default ratio
          ratio: "2/2"
        },
        {
          name: "chart2",
          url: "https://spica.internal",
          type: "pie",
          ratio: "1/1"
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
            url: "https://spica.internal",
            type: "line",
            ratio: "2/2"
          },
          {
            name: "chart2",
            url: "https://spica.internal",
            type: "pie",
            ratio: "1/1"
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
          url: "https://spica.internal",
          type: "line",
          ratio: "2/2"
        },
        {
          name: "chart2",
          url: "https://spica.internal",
          type: "pie",
          ratio: "1/1"
        }
      ]
    });
  });

  it("should update dashboard", async () => {
    let {body: insertedDashboard} = await request.post("/dashboard", dashboard);

    insertedDashboard.name = "Updated name";
    const id = insertedDashboard._id;
    delete insertedDashboard._id;

    const response = await request.put(`/dashboard/${id}`, insertedDashboard);

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual({
      _id: id,
      name: "Updated name",
      icon: "offline_bolt",
      components: [
        {
          name: "chart1",
          url: "https://spica.internal",
          type: "line",
          ratio: "2/2"
        },
        {
          name: "chart2",
          url: "https://spica.internal",
          type: "pie",
          ratio: "1/1"
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
