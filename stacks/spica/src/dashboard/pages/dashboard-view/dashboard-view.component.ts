import {ActivatedRoute} from "@angular/router";
import {Observable, BehaviorSubject} from "rxjs";
import {switchMap, tap} from "rxjs/operators";
import {DashboardService} from "../../services/dashboard.service";
import {Dashboard} from "@spica-client/dashboard/interfaces";
import {Component, OnInit} from "@angular/core";
import {BreakpointObserver, BreakpointState} from "@angular/cdk/layout";
import { GridOptions } from 'muuri';
import Grid from 'muuri';


interface ComponentStyle {
  "z-index": number;
  width: string;
  height: string;
  transform: string;
}

// interface MuuriItemStyles {
//   width: string;
//   height: string;
//   "z-index": number;
// }


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

  customTypes = ["table", "card", "statistic"];

  componentStyles: ComponentStyle[] = [];

  muuriItemStyles= [];

  localStorageKey: string;

  muuriItemPositionLocalStorageKey: string;

  customizeDisabled = false;

  arePendings: boolean[] = [];

  public layoutConfig: GridOptions = {
 
    dragEnabled: false,

  }
  ratios = ["1/1", "1/2", "2/1", "2/2", "4/2", "4/4"];


  constructor(
    private activatedRoute: ActivatedRoute,
    private ds: DashboardService,
    public breakpointObserver: BreakpointObserver
  ) {
    this.breakpointObserver
      .observe("(max-width: 1280px)")
      .subscribe((state: BreakpointState) => (this.customizeDisabled = state.matches));
  }

  ngOnInit() {
    this.dashboard$ = this.activatedRoute.params.pipe(
      switchMap(params =>
        this.ds.findOne(params.id).pipe(
          tap(dashboard => {
            if (!dashboard || !dashboard.components) {
              return;
            }

            this.clearCards();

            // for (const [index, component] of dashboard.components.entries()) {
            //   const refresh$ = new BehaviorSubject(undefined);
            //   this.refreshSubjects$.push(refresh$);

            //   this.arePendings.push(true);

            //   this.componentData$.push(
            //     refresh$.pipe(
            //       tap(() => (this.arePendings[index] = true)),
            //       switchMap(filter => this.ds.executeComponent(component.url, filter)),
            //       tap(() => (this.arePendings[index] = false))
            //     )
            //   );
            // }
          })
        )
      )
    );
  }

  onGridCreated(grid: Grid) {
    setTimeout(() => {

     

      const itemIds = grid.getItems().map((item) => {
        return item.getElement().getAttribute("id");
      });

      let layout= this.getLayout();

      if (layout) {
        console.log("bura gelirmi");
        if ((itemIds.length> layout.length)) {
          for (let i = (layout.length); i < itemIds.length; i++) {
            layout.push(itemIds[i]);  
          }  
        }
        this.loadLayout(grid, layout);
      }
      else {
        grid.layout(true);
      }
        
      grid.on("move", () => {
        this.saveLayout(grid);
      });
    }, 500);
  }

  serializeLayout(grid: Grid) {
    const itemIds = grid.getItems().map((item) => {
      return item.getElement().getAttribute("id");
    });
    return JSON.stringify(itemIds);
  }

  saveLayout(grid: Grid) {
    const layout = this.serializeLayout(grid);
    
    localStorage.setItem(this.muuriItemPositionLocalStorageKey, layout);
    
  }

  loadLayout(grid: Grid, serializedLayout) {
    
    const currentItems = grid.getItems();
    const currentItemIds = currentItems.map((item) =>
      item.getElement().getAttribute("id")
    );

    let newItems = [];
    serializedLayout.forEach((itemId) => {
      let itemIndex = currentItemIds.indexOf(itemId);
      if (itemIndex > -1) {
        newItems.push(currentItems[itemIndex]);
      }
    });
    grid.sort(newItems, { layout: "instant" });

  }


  getLayout() {

    const denem = localStorage.getItem(this.muuriItemPositionLocalStorageKey);

    const datadeneme = JSON.parse(denem);

    return datadeneme;
  }

  clearCards() {
    this.refreshSubjects$ = [];
    this.componentData$ = [];
    this.arePendings = [];
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
    let muuriGridItemSavedStyles: any = localStorage.getItem(this.localStorageKey);

    try {
      muuriGridItemSavedStyles = JSON.parse(muuriGridItemSavedStyles) || this.getDefaultComponentStyles(componentsLength);
    } catch (e) {
      muuriGridItemSavedStyles = [];
    }

    this.muuriItemStyles = muuriGridItemSavedStyles;

    // user might have added new component to dashboard
    if (componentsLength > this.muuriItemStyles.length) {
      const diff = componentsLength - this.muuriItemStyles.length;
      const addedComponentStyles = this.getDefaultComponentStyles(
        diff,
        this.muuriItemStyles.length
      );

      this.muuriItemStyles.push(...addedComponentStyles);
    }
  }
  getDefaultComponentStyles(componentsLength: number, minZIndex: number = 0) {
    return new Array(componentsLength).fill(undefined).map((_, i) => {
      return {
        "width": "240px",
        "height": "240px",
        "z-index": 1

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