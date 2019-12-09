import {DashboardController} from "./dashboard.controller";
import {DashboardService} from "./dashboard.service";
describe("DashboardController", () => {
  let dashboardController: DashboardController;
  let dashboardService: DashboardService;

  beforeEach(() => {
    dashboardService = new DashboardService();
    dashboardController = new DashboardController(dashboardService);
  });

  describe("findAll", () => {
    it("should return an array of dashboards", async () => {
      const result = [
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
      spyOn(dashboardService, "find").and.returnValue(result);
      expect(await dashboardController.findAll()).toBe(result);
    });
  });
});
