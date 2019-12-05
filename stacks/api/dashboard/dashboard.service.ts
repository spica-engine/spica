import {Injectable} from "@nestjs/common";
import {Dashboard} from "./dashboard";

@Injectable()
export class DashboardService {
  constructor() {}

  find(): Dashboard[] {
    return Array.from(global["dashboards"]).map(dashboard => {
      const data: Dashboard = {
        key: dashboard[0],
        name: dashboard[1].name,
        components: dashboard[1].components,
        icon: dashboard[1].icon
      };
      return data;
    });
  }
}
