import {Component, OnInit, Input, SimpleChanges, OnChanges, AfterViewInit} from "@angular/core";
import {Observable, BehaviorSubject} from "rxjs";
import {Dashboard, getEmptyDashboard} from "@spica-client/dashboard/interfaces";
import {GridOptions, Item} from "muuri";
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
  @Input() componentData$: Observable<object>[] = [];
  @Input() refresh: boolean = false;

  @Input() refreshSubjects$: BehaviorSubject<any>[] = [];

  arePendings: boolean[] = [];

  defaultTypes = ["line", "pie", "doughnut", "polarArea", "scatter", "bubble", "radar", "bar"];

  customTypes = ["table", "card", "statistic"];

  grid: Grid;

  onMoveListenerAttached = false;

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

    return {
      height,
      width,
      "z-index": 1
    };
  }

  attachMoveListener(grid: Grid) {
    if (this.onMoveListenerAttached) {
      return;
    }
    grid.on("move", () => {
      this.saveLayout(grid);
    });
    this.onMoveListenerAttached = true;
  }

  onGridCreated(grid: Grid) {
    // fix this settimeout
    setTimeout(() => {
      if (!grid) {
        return;
      }

      grid.refreshItems().layout();

      const itemIds = this.getItemIds(grid.getItems());
      let layout = this.getLayout();
      if (itemIds.length > layout.length) {
        for (let i = layout.length; i < itemIds.length; i++) {
          layout.push(itemIds[i]);
        }
      }
      this.loadLayout(grid, layout);

      this.attachMoveListener(grid);
    }, 500);
  }

  getItemIds(items: Item[]) {
    return items.map(item => item.getElement().getAttribute("id"));
  }

  saveLayout(grid: Grid) {
    const layout = this.getItemIds(grid.getItems());
    localStorage.setItem(this.muuriItemPositionLocalStorageKey, JSON.stringify(layout));
  }

  loadLayout(grid: Grid, layout: string[]) {
    const currentItems = grid.getItems();
    const currentItemIds = this.getItemIds(currentItems);

    let itemsOrder: Item[] = [];
    layout.forEach(itemId => {
      let itemIndex = currentItemIds.indexOf(itemId);
      if (itemIndex > -1) {
        itemsOrder.push(currentItems[itemIndex]);
      }
    });
    grid.sort(itemsOrder);
    this.grid = grid;
  }

  getLayout(): string[] {
    const muuriItemPosition = localStorage.getItem(this.muuriItemPositionLocalStorageKey);

    const muuriItemLayout = JSON.parse(muuriItemPosition);

    return muuriItemLayout || [];
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.muuriItemsLocalStorageKey = `dashboard_${this.dashboard._id}_muuri_griditem_styles`;

    this.muuriItemPositionLocalStorageKey = `dashboard_${this.dashboard._id}_muuriItemLayouts`;

    this.muuriItemStyles = [];
    this.dashboard.components.forEach((c, i) => this.setComponentStyles(c.ratio, i));

    this.onGridCreated(this.grid);
  }

  onUpdate(filters: any[] = [], i: number) {
    const queryFilter = {};

    for (const filter of filters) {
      queryFilter[filter.key] = filter.value;
    }

    this.refreshSubjects$[i].next(queryFilter);
  }
}
