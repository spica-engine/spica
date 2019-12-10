import {Module} from "@nestjs/common";
import {Module as FnModule} from "./base";

interface Dashboard {
  name: string;
  icon: string;
  components: Component[];
}
global["dashboards"] = new Map<string, Dashboard>();

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

  constructor(key: string, name: string, icon: string) {
    global["dashboards"].set(key, {
      components: this.components,
      name: name,
      icon: icon
    });
  }

  static remove(dashboardKey: string): void {
    global["dashboards"].delete(dashboardKey);
  }

  add(c: Component): this {
    this.components.push(c);
    return this;
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
