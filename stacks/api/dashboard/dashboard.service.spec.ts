import {DashboardService} from "./dashboard.service";
import {Dashboard} from "./dashboard";

describe("DashboardController", () => {
  let dashboardService: DashboardService;
  let dashboards: Dashboard[] = [
    {
      key: "dashboard_id",
      name: "My Dashboard",
      components: [{key: "component_id", type: "line", url: "test_url"}],
      icon: "icon1"
    },
    {
      key: "dashboard_id2",
      name: "My Dashboard2",
      components: [{key: "component_id", type: "line2", url: "test_url2"}],
      icon: "icon2"
    }
  ];

  beforeEach(() => {
    global["dashboards"] = new Map<string, Dashboard>();
    dashboards.forEach(dashboard => global["dashboards"].set(dashboard.key, dashboard));
    dashboardService = new DashboardService();
  });

  it("should return all dashboards", () => {
    let dashboards = dashboardService.findAll();
    expect(dashboards).toEqual([
      {
        key: "dashboard_id",
        name: "My Dashboard",
        components: [{key: "component_id", type: "line", url: "test_url"}],
        icon: "icon1"
      },
      {
        key: "dashboard_id2",
        name: "My Dashboard2",
        components: [{key: "component_id", type: "line2", url: "test_url2"}],
        icon: "icon2"
      }
    ]);
  });

  it("should return specific dashboard", () => {
    let dashboard = dashboardService.find("dashboard_id2");
    expect(dashboard).toEqual({
      key: "dashboard_id2",
      name: "My Dashboard2",
      components: [{key: "component_id", type: "line2", url: "test_url2"}],
      icon: "icon2"
    });
  });

  it("should register a new dashboard", () => {
    dashboardService.register({
      key: "dashboard_id3",
      name: "New Dashboard",
      icon: "icon3",
      components: [
        {
          key: "component_id",
          url: "test_url3",
          type: "doughnut"
        }
      ]
    });

    let dashboards = dashboardService.findAll();
    expect(dashboards).toEqual([
      {
        key: "dashboard_id",
        name: "My Dashboard",
        components: [{key: "component_id", type: "line", url: "test_url"}],
        icon: "icon1"
      },
      {
        key: "dashboard_id2",
        name: "My Dashboard2",
        components: [{key: "component_id", type: "line2", url: "test_url2"}],
        icon: "icon2"
      },
      {
        key: "dashboard_id3",
        name: "New Dashboard",
        icon: "icon3",
        components: [
          {
            key: "component_id",
            url: "test_url3",
            type: "doughnut"
          }
        ]
      }
    ]);
  });

  it("should unregister dashboard", () => {
    dashboardService.unregister("dashboard_id");
    let dashboards = dashboardService.findAll();
    expect(dashboards).toEqual([
      {
        key: "dashboard_id2",
        name: "My Dashboard2",
        components: [{key: "component_id", type: "line2", url: "test_url2"}],
        icon: "icon2"
      }
    ]);
  });
});
