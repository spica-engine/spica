import {Module} from "@nestjs/common";
import {Module as FnModule} from "./base";

global["dashboards"] = new Map<{key:string,title:string}, Component>();

abstract class Component {
  abstract readonly type: string;
  abstract readonly target: string;
  abstract readonly key: string;
}

class Charts extends Component {
  constructor(
    public readonly target: string,
    public readonly key: string,
    public readonly type: string
  ) {
    super();
  }
}

class Table extends Component {
  readonly type = "table";
  constructor(public readonly target: string, public readonly key: string) {
    super();
  }
}

class Dashboard {
  components = new Array<Component>();

  constructor(key: string,title:string) {
    global["dashboards"].set({key:key,title:title}, this.components);
  }

  add(c: Component): this {
    this.components.push(c);
    return this;
  }

  removeDashboard(dashboardName: string) {
    global["dashboards"].delete(dashboardName);
  }
}

@FnModule({moduleSpecifier: "@internal/dashboard"})
export class DashboardUnit implements FnModule {
  create(): {[key: string]: object} {
    return {
      Dashboard,
      Charts,
      Table
    };
  }
}

@Module({
  providers: [DashboardUnit],
  exports: [DashboardUnit]
})
export class DashboardUnitModule {}
