import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {Component, Inject, Optional, Type} from "@angular/core";
import {Observable} from "rxjs";
import {map, throttleTime} from "rxjs/operators";

import {Route, RouteCategory, RouteService} from "../../route";
import {LAYOUT_ACTIONS, LAYOUT_INITIALIZER} from "../config";

@Component({
  selector: "layout-home",
  templateUrl: "home.layout.html",
  styleUrls: ["home.layout.scss"]
})
export class HomeLayoutComponent {
  $routes: Observable<{key: string; value: Route[]}[]>;
  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe([Breakpoints.Handset, Breakpoints.Tablet])
    .pipe(
      throttleTime(200),
      map(result => result.matches)
    );

  constructor(
    public routeService: RouteService,
    private breakpointObserver: BreakpointObserver,
    @Optional() @Inject(LAYOUT_ACTIONS) public components: Type<any>[],
    @Optional() @Inject(LAYOUT_INITIALIZER) public initializer: Function[]
  ) {
    initializer.forEach(fn => fn.call(fn));
    this.$routes = routeService.routes.pipe(
      map((routes: Route[]) => {
        const routeMap: {[key in RouteCategory]: Route[]} = {} as any;
        routes.forEach(route => {
          routeMap[route.category] = routeMap[route.category] || [];
          routeMap[route.category].push(route);
        });

        return Object.entries(routeMap)
          .map(e => ({key: e[0], value: e[1]}))
          .sort((a, b) => {
            const order = {Primary: 0, Content: 1, System: 2, Developer: 3};
            return (order[a.key] || 0) - (order[b.key] || 0);
          });
      })
    );
  }
}
