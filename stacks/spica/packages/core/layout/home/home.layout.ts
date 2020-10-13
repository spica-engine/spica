import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {Component, Inject, OnInit, Optional, Type, ViewChild} from "@angular/core";
import {MatSidenavContainer} from "@angular/material/sidenav";
import {BehaviorSubject, Observable} from "rxjs";
import {debounceTime, map, shareReplay, switchMap} from "rxjs/operators";
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
    [RouteCategory.System, {icon: "supervisor_account", index: 2}],
    [RouteCategory.Developer, {icon: "settings", index: 3}],
    [RouteCategory.Function, {icon: "memory", index: 4}]
  ]);

  categories$: Observable<Array<{icon: string; category: RouteCategory; index: number}>>;

  currentCategory = new BehaviorSubject(null);

  constructor(
    public routeService: RouteService,
    private breakpointObserver: BreakpointObserver,
    @Optional() @Inject(LAYOUT_ACTIONS) public components: Type<any>[],
    @Optional() @Inject(LAYOUT_INITIALIZER) private initializer: Function[]
  ) {
    this.categories$ = this.routeService.routes.pipe(
      map(routes => {
        const categoryNames = Array.from(
          routes.reduce((prev, current) => {
            prev.add(current.category);
            return prev;
          }, new Set<RouteCategory>())
        );

        const categories = categoryNames
          .map(categoryName => {
            const category = this._categories.get(categoryName);
            return {
              icon: category.icon,
              category: categoryName,
              index: category.index
            };
          })
          .sort((a, b) => a.index - b.index);

        if (!this.currentCategory.value) {
          this.currentCategory.next(categories[0].category);
        }

        return categories;
      })
    );
    this.routes$ = this.currentCategory.pipe(
      switchMap(currentCategory => {
        if (!this.expanded) {
          this.toggle();
        }
        return this.routeService.routes.pipe(
          map(routes => routes.filter(r => r.category == currentCategory))
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
  }
}
