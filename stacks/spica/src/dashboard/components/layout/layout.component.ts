import {
  Component,
  OnInit,
  Input,
  SimpleChanges,
  OnChanges,
  AfterViewInit,
  ElementRef
} from "@angular/core";
import {Observable, BehaviorSubject} from "rxjs";
import {Dashboard, getEmptyDashboard} from "@spica-client/dashboard/interfaces";
import {GridOptions} from "muuri";
import Grid from "muuri";

interface MuuriItemStyles {
  width: string;
  height: string;
  "z-index": number;
}

@Component({
  selector: "dashboard-layout",
  templateUrl: "./layout.component.html",
  styleUrls: ["./layout.component.scss"]
})
export class DashboardLayout implements OnInit, OnChanges, AfterViewInit {
  constructor() {}

  muuriItemPositionLocalStorageKey: string;
  muuriItemsLocalStorageKey: string;
  muuriItemStyles: MuuriItemStyles[] = [];

  @Input() dashboard: Dashboard = getEmptyDashboard();

  @Input() draggable: boolean;

  refreshSubjects$: BehaviorSubject<any>[] = [];

  @Input() componentData$: Observable<object>[] = [];

  arePendings: boolean[] = [];

  defaultTypes = ["line", "pie", "doughnut", "polarArea", "scatter", "bubble", "radar", "bar"];

  customTypes = ["table", "card", "statistic"];

  grid: Grid;

  public layoutConfig: GridOptions = {
    items: [],
    layoutOnInit: true,
    dragEnabled: true,
    layout: {
      fillGaps: true,
      horizontal: false,
      alignRight: false,
      alignBottom: false,
      rounding: true
    },
    containerClass: "muuri",
    itemClass: "muuri-item",
    itemVisibleClass: "muuri-item-shown",
    itemHiddenClass: "muuri-item-hidden",
    itemPositioningClass: "muuri-item-positioning",
    itemDraggingClass: "muuri-item-dragging",
    itemReleasingClass: "muuri-item-releasing"
  };

  ngOnInit() {}

  ngAfterViewInit() {}

  zIndexOnHover(value: boolean, i: number) {
    if (value) {
      this.muuriItemStyles[i]["z-index"] = 1000;
    } else {
      this.muuriItemStyles[i]["z-index"] = 1;
    }
  }

  setComponentStyles(ratio: string, i: number) {
    const itemWitdh = 240;
    const itemHeight = 240;

    const column = parseInt(ratio.slice(0, 1));
    const row = parseInt(ratio.slice(2, 3));

    const height = itemHeight * row + "px";
    const width = itemWitdh * column + "px";

    this.muuriItemStyles[i] = {
      width,
      height,
      "z-index": 1
    };

    this.onGridCreated(this.grid);

    return {
      height,
      width,
      "z-index": 1
    };
  }

  onGridCreated(grid: Grid) {
    // fix this settimeout
    setTimeout(() => {
      if (!grid) {
        return;
      }

      grid.refreshItems().layout();

      const itemIds = grid.getItems().map(item => {
        return item.getElement().getAttribute("id");
      });

      let layout = this.getLayout();

      if (layout) {
        if (itemIds.length > layout.length) {
          for (let i = layout.length; i < itemIds.length; i++) {
            layout.push(itemIds[i]);
          }
        }
        this.loadLayout(grid, layout);
      } else {
        grid.layout(true);
      }

      grid.on("move", () => {
        this.saveLayout(grid);
      });
    }, 500);
  }

  serializeLayout(grid: Grid) {
    const itemIds = grid.getItems().map(item => {
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
    const currentItemIds = currentItems.map(item => item.getElement().getAttribute("id"));

    let newItems = [];
    serializedLayout.forEach(itemId => {
      let itemIndex = currentItemIds.indexOf(itemId);
      if (itemIndex > -1) {
        newItems.push(currentItems[itemIndex]);
      }
    });
    grid.sort(newItems, {layout: "instant"});
    this.grid = grid;
  }

  getLayout() {
    const muuriİtemPosition = localStorage.getItem(this.muuriItemPositionLocalStorageKey);

    const muuriItemLayout = JSON.parse(muuriİtemPosition);

    return muuriItemLayout;
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.muuriItemsLocalStorageKey = `dashboard_${this.dashboard._id}_muuri_griditem_styles`;

    this.muuriItemPositionLocalStorageKey = `dashboard_${this.dashboard._id}_muuriItemLayouts`;

    this.dashboard.components.forEach((c, i) => this.setComponentStyles(c.ratio, i));
    // console.log(changes);
  }
}
