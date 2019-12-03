import {Injectable} from "@nestjs/common";

@Injectable()
export class DashboardService {
  constructor() {}

  find() {
    return Array.from(global["dashboards"]);
  }
  findOne(key: string) {
    for (let dashboard of Array.from(global["dashboards"])) {
      if (dashboard[0].key == key) {
        return dashboard[1];
      }
    }
  }
}
