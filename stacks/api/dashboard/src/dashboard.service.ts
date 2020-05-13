import {Injectable} from "@nestjs/common";
import {Dashboard} from "./dashboard";

@Injectable()
export class DashboardService {
  constructor() {
    global["dashboards"] = new Map<string, Dashboard>();
  }

  findAll(): Dashboard[] {
    return Array.from(global["dashboards"].values());
  }

  find(key: string): Dashboard {
    return global["dashboards"].get(key);
  }

  register(dashboard: Dashboard): void {
    global["dashboards"].set(dashboard.key, dashboard);
  }

  unregister(key: string): void {
    global["dashboards"].delete(key);
  }
}
