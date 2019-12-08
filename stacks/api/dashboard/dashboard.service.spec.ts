import {DashboardService} from "./dashboard.service";

describe("DashboardController", () => {
  let dashboardService: DashboardService;

  beforeEach(() => {
    dashboardService = new DashboardService();
  });

  describe("find", () => {
    it("should return an array of dashboards", async () => {
      const dashboards = [
        {
          key: "test-dashboard",
          name: "Test Dashboard",
          components: [{type: "line", target: "test-dashboard", key: "linedata"}],
          icon: "dashboard"
        },
        {
          key: "test-dashboard2",
          name: "Test Dashboard2",
          components: [{type: "pie", target: "test-dashboard2", key: "piedata"}],
          icon: "dashboard"
        }
      ];
      spyOn(dashboardService, "find").and.returnValue(dashboards);
      expect(dashboardService.find()).toBe(dashboards);
    });
  });
});
