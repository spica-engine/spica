import {Component, OnInit, Input, SimpleChanges, OnChanges, AfterViewInit} from "@angular/core";
import {Observable, BehaviorSubject, Subject, combineLatest} from "rxjs";
import {
  Dashboard,
  fillComponentRatios,
  getEmptyDashboard
} from "@spica-client/dashboard/interfaces";
import {GridOptions, Item} from "muuri";
import Grid from "muuri";
import {delay, map} from "rxjs/operators";

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
  onStyleChanged$: BehaviorSubject<any>;
  onGridCreated$: Subject<Grid>;

  constructor() {
    this.onStyleChanged$ = new BehaviorSubject("");
    this.onGridCreated$ = new Subject<Grid>();
    combineLatest(this.onStyleChanged$, this.onGridCreated$)
      .pipe(
        map(([, grid]) => grid),
        delay(1)
      )
      .subscribe(grid => this.updateGrid(grid));
  }

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
    const gap = 10;

    const itemWitdh = 240;
    const itemHeight = 240;

    const column = parseInt(ratio.slice(0, 1));
    const row = parseInt(ratio.slice(2, 3));

    const columnDiff = (column - 1) * gap;
    const rowDiff = (row - 1) * gap;

    const width = itemWitdh * column + columnDiff + "px";
    const height = itemHeight * row + rowDiff + "px";

    this.muuriItemStyles[i] = {
      width,
      height,
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
    this.onGridCreated$.next(grid);
  }

  updateGrid(grid: Grid) {
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
    this.dashboard.components = fillComponentRatios(this.dashboard.components);
    this.dashboard.components.forEach((c, i) => this.setComponentStyles(c.ratio, i));

    this.onStyleChanged$.next("");
  }

  onUpdate(filters: any[] = [], i: number) {
    const queryFilter = {};

    for (const filter of filters) {
      queryFilter[filter.key] = filter.value;
    }

    this.refreshSubjects$[i].next(queryFilter);
  }
}
