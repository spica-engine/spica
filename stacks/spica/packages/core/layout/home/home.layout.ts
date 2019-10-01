import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {Component, Inject, OnInit, Optional, Type} from "@angular/core";
import {BehaviorSubject, Observable} from "rxjs";
import {debounceTime, map, switchMap} from "rxjs/operators";
import {Route, RouteCategory, RouteService} from "../../route";
import {LAYOUT_ACTIONS, LAYOUT_INITIALIZER} from "../config";

@Component({
  selector: "layout-home",
  templateUrl: "home.layout.html",
  styleUrls: ["home.layout.scss"]
})
export class HomeLayoutComponent implements OnInit {
  routes$: Observable<Route[]>;
  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe([Breakpoints.Medium, Breakpoints.Small, Breakpoints.XSmall])
    .pipe(
      debounceTime(200),
      map(result => result.matches)
    );

  categories: Array<{icon: string; category: RouteCategory}> = [
    {
      icon: "stars",
      category: RouteCategory.Primary
    },
    {
      icon: "view_stream",
      category: RouteCategory.Content
    },
    {
      icon: "terrain",
      category: RouteCategory.System
    },
    {
      icon: "double_arrow",
      category: RouteCategory.Developer
    }
  ];

  currentCategory = new BehaviorSubject(RouteCategory.Primary);

  constructor(
    public routeService: RouteService,
    private breakpointObserver: BreakpointObserver,
    @Optional() @Inject(LAYOUT_ACTIONS) public components: Type<any>[],
    @Optional() @Inject(LAYOUT_INITIALIZER) private initializer: Function[]
  ) {
    this.routes$ = this.currentCategory.pipe(
      switchMap(category =>
        this.routeService.routes.pipe(map(routes => routes.filter(r => r.category == category)))
      )
    );
  }

  ngOnInit(): void {
    this.initializer.forEach(fn => fn.call(fn));
  }
}
