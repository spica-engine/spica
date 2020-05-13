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
      components: [{key: "component_id", type: "pie", url: "test_url2"}],
      icon: "icon2"
    }
  ];

  beforeEach(() => {
    dashboardService = new DashboardService();
    dashboardService.register(dashboards[0]);
    dashboardService.register(dashboards[1]);
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
        components: [{key: "component_id", type: "pie", url: "test_url2"}],
        icon: "icon2"
      }
    ]);
  });

  it("should return specific dashboard", () => {
    let dashboard = dashboardService.find("dashboard_id2");
    expect(dashboard).toEqual({
      key: "dashboard_id2",
      name: "My Dashboard2",
      components: [{key: "component_id", type: "pie", url: "test_url2"}],
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
        components: [{key: "component_id", type: "pie", url: "test_url2"}],
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

  it("should update dashboard", () => {
    dashboardService.register({
      key: "dashboard_id",
      name: "My Updated Dashboard",
      components: [
        {key: "component_id", type: "line", url: "test_url"},
        {key: "component_id2", type: "pie", url: "test_url2"}
      ],
      icon: "icon1"
    });

    let dashboards = dashboardService.findAll();
    expect(dashboards).toEqual([
      {
        key: "dashboard_id",
        name: "My Updated Dashboard",
        components: [
          {key: "component_id", type: "line", url: "test_url"},
          {key: "component_id2", type: "pie", url: "test_url2"}
        ],
        icon: "icon1"
      },
      {
        key: "dashboard_id2",
        name: "My Dashboard2",
        components: [{key: "component_id", type: "pie", url: "test_url2"}],
        icon: "icon2"
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
        components: [{key: "component_id", type: "pie", url: "test_url2"}],
        icon: "icon2"
      }
    ]);
  });
});
