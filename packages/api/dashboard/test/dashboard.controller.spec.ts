import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {DashboardModule} from "@spica-server/dashboard";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {contractSuite} from "@spica-server/database-testing";
import {SchemaModule} from "@spica-server/core-schema";
import {OBJECT_ID} from "@spica-server/core-schema";
import {idOf, stripId, withId} from "@spica-server/data";

contractSuite("DashboardController", engine => {
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
        DashboardModule.forRoot({realtime: false}),
        engine.module(),
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
    expect(response.body).toEqual(
      withId(
        {
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
        },
        idOf(response.body)
      )
    );
  });

  it("should get all dashboards", async () => {
    const {body: insertedDashboard} = await request.post("/dashboard", dashboard);

    const response = await request.get("/dashboard");

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      withId(
        {
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
        },
        idOf(insertedDashboard)
      )
    ]);
  });

  it("should get specific dashboard", async () => {
    const {body: insertedDashboard} = await request.post("/dashboard", dashboard);

    const response = await request.get(`/dashboard/${idOf(insertedDashboard)}`);

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual(
      withId(
        {
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
        },
        idOf(insertedDashboard)
      )
    );
  });

  it("should update dashboard", async () => {
    let {body: insertedDashboard} = await request.post("/dashboard", dashboard);

    insertedDashboard.name = "Updated name";
    const id = idOf(insertedDashboard);
    stripId(insertedDashboard);

    const response = await request.put(`/dashboard/${id}`, insertedDashboard);

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual(
      withId(
        {
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
        },
        id
      )
    );
  });

  it("should delete dashboard", async () => {
    const {body: insertedDashboard} = await request.post("/dashboard", dashboard);

    const response = await request.delete(`/dashboard/${idOf(insertedDashboard)}`);

    expect([response.statusCode, response.statusText]).toEqual([204, "No Content"]);

    const {body: dashboards} = await request.get("/dashboard");
    expect(dashboards).toEqual([]);
  });
});
