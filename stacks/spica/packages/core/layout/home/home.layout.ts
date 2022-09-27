import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {Component, Inject, OnInit, Optional, Type, ViewChild} from "@angular/core";
import {MatSidenavContainer} from "@angular/material/sidenav";
import {BehaviorSubject, Observable} from "rxjs";
import {debounceTime, map, shareReplay, switchMap, tap} from "rxjs/operators";
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
  DEFAULT_DISPLAY_TYPE = "row";
  routes$: Observable<Route[]>;
  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe([Breakpoints.Medium, Breakpoints.Small, Breakpoints.XSmall])
    .pipe(
      debounceTime(200),
      map(result => result.matches)
    );

  private _categories = new Map([
    [
      RouteCategory.Primary,
      {icon: "stars", index: 0, children: {name: RouteCategory.Primary_Sub, icon: "list"}}
    ],
    [
      RouteCategory.Content,
      {
        icon: "view_stream",
        index: 1,
        children: {name: RouteCategory.Content_Sub, icon: "format_list_numbered"}
      }
    ],
    [
      RouteCategory.System,
      {
        icon: "supervisor_account",
        index: 2,
        children: {name: RouteCategory.System_Sub, icon: "list"}
      }
    ],
    [
      RouteCategory.Developer,
      {icon: "memory", index: 3, children: {name: RouteCategory.Developer_Sub, icon: "bug_report"}}
    ],
    [
      RouteCategory.Webhook,
      {icon: "http", index: 4, children: {name: RouteCategory.Webhook_Sub, icon: "bug_report"}}
    ]
  ]);

  categories$: Observable<
    Array<{icon: string; category: RouteCategory; index: number; children: object}>
  >;

  currentCategory = new BehaviorSubject(null);

  constructor(
    public routeService: RouteService,
    private breakpointObserver: BreakpointObserver,
    @Optional() @Inject(LAYOUT_ACTIONS) public components: Type<any>[],
    @Optional() @Inject(LAYOUT_INITIALIZER) private initializer: Function[]
  ) {
    this.categories$ = this.routeService.routes.pipe(
      map(routes => {
        const categoryNames = Array.from(this._categories.keys());
        const categories = categoryNames
          .map(categoryName => {
            const category = this._categories.get(categoryName);
            return {
              icon: category.icon,
              category: categoryName,
              index: category.index,
              children: {
                items: routes.filter(route => route.category == category.children.name),
                icon: category.children.icon
              }
            };
          })
          .sort((a, b) => a.index - b.index);
        if (!this.currentCategory.value) {
          this.currentCategory.next(categories[0]);
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
          map(routes => routes.filter(r => r.category == currentCategory.category))
        );
      }),
      map(routes => routes.sort((a, b) => a.index - b.index))
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

  filterArrayByDisplay(array: [], value: any) {
    return array.filter(item => (item["displayType"] || this.DEFAULT_DISPLAY_TYPE) == value);
  }
}
