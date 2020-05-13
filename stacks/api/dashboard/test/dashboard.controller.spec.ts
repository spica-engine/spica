import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DashboardModule} from "@spica-server/dashboard";
import {PassportTestingModule} from "@spica-server/passport/testing";

describe("DashboardController", () => {
  let request: Request;
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [CoreTestingModule, PassportTestingModule.initialize(), DashboardModule]
    }).compile();

    request = module.get(Request);

    app = module.createNestApplication();

    await app.listen(request.socket);
  });

  afterEach(async () => {
    await app.close();
  });

  it("should get all dashboards", async () => {
    await request.put("/dashboard", {
      key: "first_dashboard",
      name: "First Dashboard",
      icon: "none",
      components: [
        {
          key: "bar_component",
          type: "bar",
          url: "some_url"
        }
      ]
    });

    await request.put("/dashboard", {
      key: "second_dashboard",
      name: "Second Dashboard",
      icon: "none",
      components: [
        {
          key: "table_component",
          type: "table",
          url: "some_url"
        }
      ]
    });

    let response = await request.get("/dashboard", {});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual([
      {
        key: "first_dashboard",
        name: "First Dashboard",
        icon: "none",
        components: [
          {
            key: "bar_component",
            type: "bar",
            url: "some_url"
          }
        ]
      },
      {
        key: "second_dashboard",
        name: "Second Dashboard",
        icon: "none",
        components: [
          {
            key: "table_component",
            type: "table",
            url: "some_url"
          }
        ]
      }
    ]);
  });

  it("should get specific dashboard", async () => {
    await request.put("/dashboard", {
      key: "first_dashboard",
      name: "First Dashboard",
      icon: "none",
      components: [
        {
          key: "bar_component",
          type: "bar",
          url: "some_url"
        }
      ]
    });

    let response = await request.get(`/dashboard/first_dashboard`, {});

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    expect(response.body).toEqual({
      key: "first_dashboard",
      name: "First Dashboard",
      icon: "none",
      components: [
        {
          key: "bar_component",
          type: "bar",
          url: "some_url"
        }
      ]
    });
  });

  it("should register a new dashboard", async () => {
    let response = await request.put("/dashboard", {
      key: "first_dashboard",
      name: "First Dashboard",
      icon: "none",
      components: [
        {
          key: "bar_component",
          type: "bar",
          url: "some_url"
        }
      ]
    });

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);

    let {body: dashboards} = await request.get("/dashboard", {});

    expect(dashboards).toEqual([
      {
        key: "first_dashboard",
        name: "First Dashboard",
        icon: "none",
        components: [
          {
            key: "bar_component",
            type: "bar",
            url: "some_url"
          }
        ]
      }
    ]);
  });

  it("should update dashboard", async () => {
    await request.put("/dashboard", {
      key: "first_dashboard",
      name: "First Dashboard",
      icon: "none",
      components: [
        {
          key: "bar_component",
          type: "bar",
          url: "some_url"
        }
      ]
    });

    let response = await request.put("/dashboard", {
      key: "first_dashboard",
      name: "First Updated Dashboard",
      icon: "none",
      components: [
        {
          key: "pie_component",
          type: "pie",
          url: "some_url"
        }
      ]
    });

    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);

    let {body: dashboards} = await request.get("/dashboard", {});

    expect(dashboards).toEqual([
      {
        key: "first_dashboard",
        name: "First Updated Dashboard",
        icon: "none",
        components: [
          {
            key: "pie_component",
            type: "pie",
            url: "some_url"
          }
        ]
      }
    ]);
  });

  it("should unregister dashboard", async () => {
    await request.put("/dashboard", {
      key: "first_dashboard",
      name: "First Dashboard",
      icon: "none",
      components: [
        {
          key: "bar_component",
          type: "bar",
          url: "some_url"
        }
      ]
    });

    let response = await request.delete(`/dashboard/first_dashboard`);

    expect([response.statusCode, response.statusText]).toEqual([204, "No Content"]);
    expect(response.body).toBeUndefined();

    let {body: dashboards} = await request.get("/dashboard", {});

    expect(dashboards).toEqual([]);
  });
});
