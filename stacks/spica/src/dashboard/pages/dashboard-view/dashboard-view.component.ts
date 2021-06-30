import {ActivatedRoute} from "@angular/router";
import {Observable, BehaviorSubject} from "rxjs";
import {switchMap, tap} from "rxjs/operators";
import {DashboardService} from "../../services/dashboard.service";
import {Dashboard} from "@spica-client/dashboard/interfaces";
import {Component, OnInit} from "@angular/core";
import {BreakpointObserver, Breakpoints, BreakpointState} from "@angular/cdk/layout";

interface ComponentStyle {
  "z-index": number;
  width: string;
  height: string;
  transform: string;
}

@Component({
  selector: "app-dashboard-view",
  templateUrl: "./dashboard-view.component.html",
  styleUrls: ["./dashboard-view.component.scss"]
})
export class DashboardViewComponent implements OnInit {
  dashboard$: Observable<Dashboard>;

  componentData$: Observable<object>[] = [];

  refreshSubjects$: BehaviorSubject<any>[] = [];

  defaultTypes = ["line", "pie", "doughnut", "polarArea", "scatter", "bubble", "radar", "bar"];

  customTypes = ["table", "card"];

  componentStyles: ComponentStyle[] = [];

  localStorageKey: string;

  customizeDisabled = false;

  constructor(
    private activatedRoute: ActivatedRoute,
    private ds: DashboardService,
    public breakpointObserver: BreakpointObserver
  ) {
    this.breakpointObserver.observe("(max-width: 1280px)").subscribe((state: BreakpointState) => {
      this.customizeDisabled = state.matches;
      // if (this.customizeDisabled) {
      //   setTimeout(() => this.autoAlign(1), 100);
      //   this.saveComponentStyles();
      // }
    });
  }

  ngOnInit() {
    this.dashboard$ = this.activatedRoute.params.pipe(
      switchMap(params =>
        this.ds.findOne(params.id).pipe(
          tap(dashboard => {
            if (!dashboard || !dashboard.components) {
              return;
            }

            this.refreshSubjects$ = [];
            this.componentData$ = [];

            this.localStorageKey = `dashboard_${dashboard._id}_component_styles`;

            this.loadComponentStyles(dashboard.components.length);
            this.saveComponentStyles();

            for (const component of dashboard.components) {
              const refresh$ = new BehaviorSubject(undefined);
              this.refreshSubjects$.push(refresh$);
              this.componentData$.push(
                refresh$.pipe(switchMap(filter => this.ds.executeComponent(component.url, filter)))
              );
            }
          })
        )
      )
    );
  }

  onUpdate(filters: any[] = [], i: number) {
    const queryFilter = {};

    for (const filter of filters) {
      queryFilter[filter.key] = filter.value;
    }

    this.refreshSubjects$[i].next(queryFilter);
  }

  reOrderZIndexes(i: number) {
    const highestZ = this.componentStyles.length - 1;
    const currentZ = JSON.parse(JSON.stringify(this.componentStyles[i]["z-index"]));

    this.componentStyles = this.componentStyles.map(style => {
      if (style["z-index"] == currentZ) {
        style["z-index"] = highestZ;
        return style;
      } else if (style["z-index"] > currentZ) {
        style["z-index"]--;
        return style;
      }
      return style;
    });
  }

  onEditEnded(component: HTMLElement, i: number) {
    let {transform, width, height} = getComputedStyle(component);
    const {m41: translateX, m42: translateY} = new WebKitCSSMatrix(transform);

    const container = document.getElementsByClassName("dashboard-container")[0] as HTMLElement;
    const containerWidth = container.clientWidth;

    width = Math.min(parseInt(width), containerWidth - translateX) + "px";

    this.reOrderZIndexes(i);

    this.componentStyles[i].width = width;
    this.componentStyles[i].height = height;
    this.componentStyles[i].transform = `translate3d(${translateX}px, ${translateY}px, 0px)`;

    this.saveComponentStyles();
  }

  saveComponentStyles() {
    localStorage.removeItem(this.localStorageKey);
    localStorage.setItem(this.localStorageKey, JSON.stringify(this.componentStyles));
  }

  loadComponentStyles(componentsLength: number) {
    let savedStyles: any = localStorage.getItem(this.localStorageKey);

    try {
      savedStyles = JSON.parse(savedStyles) || this.getDefaultComponentStyles(componentsLength);
    } catch (e) {
      savedStyles = [];
    }

    this.componentStyles = savedStyles;

    // user might have added new component to dashboard
    if (componentsLength > this.componentStyles.length) {
      const diff = componentsLength - this.componentStyles.length;
      const addedComponentStyles = this.getDefaultComponentStyles(
        diff,
        this.componentStyles.length
      );

      this.componentStyles.push(...addedComponentStyles);
    }
  }

  getDefaultComponentStyles(componentsLength: number, minZIndex: number = 0) {
    const width = 500;
    const height = 500;

    const container = document.getElementsByClassName("dashboard-container")[0] as HTMLElement;
    const containerWidth = container.clientWidth;

    let multiplierX = -1;
    let multiplierY = -1;

    let toRight = true;

    return new Array(componentsLength).fill(undefined).map((_, i) => {
      toRight ? multiplierX++ : multiplierX--;
      multiplierY++;

      const translateX = multiplierX * 50;
      const translateY = multiplierY * 50;

      const nextIteration = (multiplierX + (toRight ? 1 : -1)) * 50;

      if (nextIteration + width >= containerWidth || nextIteration < 0) {
        toRight = !toRight;
      }
      return {
        "z-index": minZIndex + i,
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate3d(${translateX}px, ${translateY}px, 0px)`
      };
    });
  }

  autoAlign(columns: number) {
    const margin = 10;

    const container = document.getElementsByClassName("dashboard-container")[0] as HTMLElement;
    const containerWidth = container.clientWidth - (columns + 1) * margin;

    const componentHeight = 500;
    const componentWidth = containerWidth / columns;

    const rows = this.componentStyles.length / columns;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const index = x + y * columns;

        if (index > this.componentStyles.length - 1) {
          break;
        }

        const translateX = x * componentWidth + margin * x;
        const translateY = y * componentHeight + margin * y;

        this.componentStyles[index].width = componentWidth + "px";
        this.componentStyles[index].height = componentHeight + "px";
        this.componentStyles[
          index
        ].transform = `translate3d(${translateX}px, ${translateY}px, 0px)`;
      }
    }
  }
}
