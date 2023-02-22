import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {
  Component,
  ComponentFactoryResolver,
  Inject,
  OnInit,
  Optional,
  ViewChild,
  ViewContainerRef
} from "@angular/core";
import {MatSidenavContainer} from "@angular/material/sidenav";
import {BehaviorSubject, Observable} from "rxjs";
import {debounceTime, map, switchMap, tap} from "rxjs/operators";
import {Route, RouteCategory, RouteService} from "../../route";
import {LAYOUT_ACTIONS, LAYOUT_INITIALIZER} from "../config";
import {rootCategories} from "@spica-client/core/route/route";

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
  isSidebarReady: boolean = false;
  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe([Breakpoints.Medium, Breakpoints.Small, Breakpoints.XSmall])
    .pipe(
      debounceTime(200),
      map(result => result.matches)
    );

  categories$: Observable<
    Array<{icon: string; category: RouteCategory; index: number; children: object}>
  >;

  _categories = rootCategories;
  currentCategory = new BehaviorSubject(null);
  currentCategoryName: string;

  @ViewChild("placeholder", {read: ViewContainerRef, static: false})
  public placeholder!: ViewContainerRef;

  constructor(
    public routeService: RouteService,
    private breakpointObserver: BreakpointObserver,
    @Optional()
    @Inject(LAYOUT_ACTIONS)
    public components: {component: Component; position: "left" | "right" | "center"}[],
    @Optional() @Inject(LAYOUT_INITIALIZER) private initializer: Function[],
    private resolver: ComponentFactoryResolver
  ) {
    this.categories$ = this.routeService.routes.pipe(
      map(routes => {
        const categoryNames = Array.from(this._categories.keys());
        const categories = categoryNames
          .filter(categoryName => routes.some(route => route.category == categoryName))
          .map(categoryName => {
            this.isSidebarReady = true;
            const category = this._categories.get(categoryName);
            return {
              icon: category.icon,
              category: categoryName,
              index: category.index,
              drawer: category.drawer,
              props: category.props,
              children: {
                items: routes.filter(route => route.category == category.children.name),
                icon: category.children.icon
              }
            };
          })
          .sort((a, b) => a.index - b.index);
        if (!this.currentCategory.value) {
          this.currentCategory.next(categories[0]);
          setTimeout(() => {
            this.setDrawer(categories[0]);
          }, 200);
        }

        return categories;
      })
    );
    this.routes$ = this.currentCategory.pipe(
      tap(currentCategory => this.setDrawer(currentCategory)),
      tap(currentCategory => (this.currentCategoryName = currentCategory.category)),
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
  filterComponentsByPosition(position: string = "right") {
    return this.components.filter(component => component.position == position);
  }

  setDrawer(currentCategory) {
    if (
      this.placeholder &&
      currentCategory.drawer &&
      this.currentCategoryName != currentCategory.category
    ) {
      this.placeholder.clear();

      const componentFactory = this.resolver.resolveComponentFactory(currentCategory.drawer);

      const component = this.placeholder.createComponent(componentFactory);
      component.instance["routes$"] = this.routes$;
      component.instance["currentCategory"] = this.currentCategory;

      Object.keys(currentCategory.props).forEach(key => {
        component.instance[key] = currentCategory.props[key];
      });
    }
  }
}
