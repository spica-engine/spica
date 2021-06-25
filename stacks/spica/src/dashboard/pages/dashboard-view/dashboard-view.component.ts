import {ActivatedRoute} from "@angular/router";
import {Observable, BehaviorSubject} from "rxjs";
import {switchMap, tap} from "rxjs/operators";
import {DashboardService} from "../../services/dashboard.service";
import {Component as DashboardComponent, Dashboard} from "@spica-client/dashboard/interfaces";
import {Component, OnInit} from "@angular/core";

@Component({
  selector: "app-dashboard-view",
  templateUrl: "./dashboard-view.component.html",
  styleUrls: ["./dashboard-view.component.scss"]
})
export class DashboardViewComponent implements OnInit {
  _id: string;
  dashboard$: Observable<Dashboard>;

  componentData$: Observable<object>[] = [];

  refreshSubjects$: BehaviorSubject<any>[] = [];

  defaultTypes = ["line", "pie", "doughnut", "polarArea", "scatter", "bubble", "radar", "bar"];

  customTypes = ["table", "card"];

  constructor(private activatedRoute: ActivatedRoute, private ds: DashboardService) {}

  ngOnInit() {
    this.dashboard$ = this.activatedRoute.params.pipe(
      switchMap(params =>
        this.ds.findOne(params.id).pipe(
          tap(dashboard => {
            if (!dashboard || !dashboard.components) {
              return;
            }

            this._id = dashboard._id;
            
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

  componentStyles: {
    "z-index": number;
    width: string;
    height: string;
    transform: string;
  }[] = [];

  onEditEnded(component: HTMLElement, i: number) {
    let {transform, width, height} = getComputedStyle(component);
    const {m41: translateX, m42: translateY} = new WebKitCSSMatrix(transform);

    const container = document.getElementsByClassName("container")[0] as HTMLElement;
    const containerWidth = container.clientWidth;

    width = Math.min(parseInt(width), containerWidth - translateX) + "px";

    this.reOrderZIndexes(i);

    this.componentStyles[i].width = width;
    this.componentStyles[i].height = height;
    this.componentStyles[i].transform = `translate3d(${translateX}px, ${translateY}px, 0px)`;

    this.saveComponentStyles();
  }

  saveComponentStyles() {
    localStorage.setItem(
      `dashboard_${this._id}_component_styles`,
      JSON.stringify(this.componentStyles)
    );
  }

  loadComponentStyles(components: DashboardComponent[]) {
    let savedStyles: any = localStorage.getItem(`dashboard_${this._id}_component_styles`);

    try {
      savedStyles = JSON.parse(savedStyles);

      if (savedStyles.length) {
        this.componentStyles = savedStyles;

        // user might have added new component to dashboard
        if (components.length > this.componentStyles.length) {
          const diff = components.length - this.componentStyles.length;
          const addedComponentStyles = this.getDefaultComponentStyles(
            diff,
            this.componentStyles.length
          );

          this.componentStyles.push(...addedComponentStyles);
          this.saveComponentStyles();
        }

        return;
      }
    } catch (e) {}

    this.componentStyles = this.getDefaultComponentStyles(components.length);
  }

  getDefaultComponentStyles(length: number, minZIndex: number = 0) {
    const width = 500;
    const height = 500;

    const container = document.getElementsByClassName("components-container")[0] as HTMLElement;
    const containerWidth = container.clientWidth;

    let multiplierX = 0;
    let multiplierY = 0;

    let goRight = true;

    return new Array(length).fill(undefined).map((_, i) => {
      goRight ? multiplierX++ : multiplierX--;
      multiplierY++;

      const translateX = multiplierX * 50;
      const translateY = multiplierY * 50;

      const nextIteration = (multiplierX + (goRight ? 1 : -1)) * 50;

      if (nextIteration + width >= containerWidth || nextIteration <= 0) {
        goRight = !goRight;
      }
      return {
        "z-index": minZIndex + i,
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate3d(${translateX}px, ${translateY}px, 0px)`
      };
    });
  }
}
