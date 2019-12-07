import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {Component, Inject, OnInit, Optional, Type, ViewChild} from "@angular/core";
import {MatSidenavContainer} from "@angular/material";
import {BehaviorSubject, Observable} from "rxjs";
import {debounceTime, map, switchMap} from "rxjs/operators";
import {Route, RouteCategory, RouteService} from "../../route";
import {LAYOUT_ACTIONS, LAYOUT_INITIALIZER} from "../config";

@Component({
  selector: "layout-home",
  templateUrl: "home.layout.html",
  styleUrls: ["home.layout.scss"],
  host: {
    "[class.expanded]": "expanded"
  }
})
export class HomeLayoutComponent implements OnInit {
  @ViewChild(MatSidenavContainer, {static: true}) sidenav: MatSidenavContainer;

  expanded = true;

  routes$: Observable<Route[]>;
  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe([Breakpoints.Medium, Breakpoints.Small, Breakpoints.XSmall])
    .pipe(
      debounceTime(200),
      map(result => result.matches)
    );

  private _categories = new Map([
    [RouteCategory.Primary, {icon: "stars", index: 0}],
    [RouteCategory.Content, {icon: "view_stream", index: 1}],
    [RouteCategory.System, {icon: "terrain", index: 2}],
    [RouteCategory.Developer, {icon: "double_arrow", index: 3}]
  ]);

  categories: Array<{icon: string; category: RouteCategory; index: number}> = [];

  currentCategory = new BehaviorSubject(null);

  constructor(
    public routeService: RouteService,
    private breakpointObserver: BreakpointObserver,
    @Optional() @Inject(LAYOUT_ACTIONS) public components: Type<any>[],
    @Optional() @Inject(LAYOUT_INITIALIZER) private initializer: Function[]
  ) {
    this.routes$ = this.currentCategory.pipe(
      switchMap(category => {
        if (!this.expanded) {
          this.toggle();
        }

        return this.routeService.routes.pipe(
          map(routes => {
            for (const route of routes) {
              if (!this.categories.find(c => c.category == route.category)) {
                this.categories.push({
                  icon: this._categories.get(route.category).icon,
                  category: route.category,
                  index: this._categories.get(route.category).index
                });
              }
            }

            this.categories = this.categories.sort((a, b) => a.index - b.index);

            !this.currentCategory.value && this.currentCategory.next(this.categories[0].category);

            return routes.filter(r => r.category == category);
          })
        );
      })
    );
  }

  ngOnInit(): void {
    if (!this.initializer) {
      return;
    }
    this.initializer.forEach(fn => fn.call(fn));
  }

  toggle(): void {
    this.expanded = !this.expanded;
    setTimeout(() => this.sidenav.updateContentMargins(), 400);
  }
}
