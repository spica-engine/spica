import {Route} from "./route";
import {Retrieve} from "./route.reducer";
import {RouteService} from "./route.service";

export class RouteInitializer {
  constructor(
    private routeService: RouteService,
    private routes: Route[]
  ) {}
  initialize(): void {
    const routes = [].concat.apply([], this.routes) as Route[];
    this.routeService.dispatch(new Retrieve(routes));
  }
}
