import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Dashboard, getEmptyDashboard } from "@spica-client/dashboard/interfaces";
import { DashboardService } from "@spica-client/dashboard/services/dashboard.service";
import { filter, map, switchMap, take, tap, takeUntil } from "rxjs/operators";
import { Subject } from "rxjs";
import { ICONS } from "@spica-client/material";
import { MatDialog } from "@angular/material/dialog";
import { ExampleComponent } from "@spica-client/common/example";
import { deepCopy } from "@spica-client/core";
import { Observable, BehaviorSubject } from "rxjs";
import { GridOptions } from 'muuri';
import Muuri from 'muuri';
import Grid from 'muuri';
import Item from 'muuri';
import _ from "lodash";
import { log } from "console";
import { DashboardLayout } from "@spica-client/dashboard/components/layout/layout.component";


interface ComponentStyle {
  "z-index": number;
  width: string;
  height: string;
  transform: string;
}

interface MuuriItemStyles {
  width: string;
  height: string;
  "z-index": number;
}

@Component({
  selector: "dashboard-add",
  templateUrl: "./add.component.html",
  styleUrls: ["./add.component.scss"]
})

export class AddComponent implements OnInit, OnDestroy {

  dashboard$: Observable<Dashboard>;

  denemeDashboard$: Observable<Dashboard>;

  componentData$: Observable<object>[] = [];


  mockData = [];

  mockDashboard: object;

  refreshSubjects$: BehaviorSubject<any>[] = [];

  defaultTypes = ["line", "pie", "doughnut", "polarArea", "scatter", "bubble", "radar", "bar"];

  customTypes = ["table", "card", "statistic"];

  componentStyles: ComponentStyle[] = [];

  muuriItemStyles: MuuriItemStyles[] = [];

  localStorageKey: string;

  muuriItemsLocalStorageKey: string;

  muuriItemPositionLocalStorageKey: string;

  mockDataLocalStorageKey: string;

  customizeDisabled = false;

  arePendings: boolean[] = [];

  reset: boolean = true;

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
    // sortData: {
    //   id: function (item, element) {
    //     return parseFloat(element.getAttribute("id"))
    //   }
    // },
    containerClass: 'muuri',
    itemClass: 'muuri-item',
    itemVisibleClass: 'muuri-item-shown',
    itemHiddenClass: 'muuri-item-hidden',
    itemPositioningClass: 'muuri-item-positioning',
    itemDraggingClass: 'muuri-item-dragging',
    itemReleasingClass: 'muuri-item-releasing'
  }

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private dashboardService: DashboardService,
    private dialog: MatDialog
  ) { }

  dashboard: Dashboard = getEmptyDashboard();
  onDestroy$: Subject<any> = new Subject();

  types = [
    "line",
    "pie",
    "doughnut",
    "polarArea",
    "scatter",
    "bubble",
    "radar",
    "bar",
    "table",
    "card",
    "statistic"
  ];

  ratios = ["1/1", "1/2", "2/1", "2/2", "4/2", "4/4"];

  readonly icons: Array<string> = ICONS;
  readonly iconPageSize = 21;

  visibleIcons: Array<any> = this.icons.slice(0, this.iconPageSize);

  grid: any;


  refreshedItems:boolean = false;

  positionedItem:boolean = true;

  chartHovered: boolean = false;

  @ViewChild("myGrid") myGrid: any;
  
  @ViewChild(DashboardLayout) ratioArrange: DashboardLayout;
  ngOnInit() {
   

  
    
    this.denemeDashboard$=this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        map(params => params.id),
        switchMap(id =>
          this.dashboardService.findOne(id).pipe(
            tap(dashboard => {
              if (dashboard) {
                this.reset = false;
                this.dashboard = deepCopy(dashboard);
                
              
              }
            })
          )
        ),
        
        takeUntil(this.onDestroy$)
      );


    this.dashboard$ = this.activatedRoute.params.pipe(
      switchMap(params =>
        this.dashboardService.findOne(params.id).pipe(
          tap(dashboard => {
            if (!dashboard || !dashboard.components) {
              return;
            }

            this.clearCards();

            this.muuriItemsLocalStorageKey = `dashboard_${dashboard._id}_muuri_griditem_styles`;

            this.muuriItemPositionLocalStorageKey = `dashboard_${dashboard._id}_muuriItemLayouts`;

            this.mockDataLocalStorageKey = `dashboard_${dashboard._id}_mockData`;

            for (let component of this.dashboard.components) {
    
              this.mockData.push(JSON.parse(this.dashboardService.getExample(component.type)));
              
            }
            
          })
        )
      )
    );

    console.log("asd",this.mockData);
    
   
  }

  onRatioChoose(ratio: string, i:number) {

    this.ratioArrange.onGrid(ratio, i);

    // const parent = document.querySelectorAll(".item");

    // console.log("ratio", this.grid);

    // const itemWitdh = 240;
    // const itemHeight = 240;

    // const column = parseInt(ratio.slice(0, 1));
    // const row = parseInt(ratio.slice(2, 3));

    // if (!parent[i]) {
    //   return;
    // }
    // else {
    //   this.muuriItemStyles[i].height = (itemHeight * row) + "px";
    //   this.muuriItemStyles[i].width = (itemWitdh * column) +"px";
    //   this.refreshedItems=true;
    //   this.onGridCreated(this.grid);
    // }

    // this.saveComponentStyles();

  }

  clearCards() {
    this.refreshSubjects$ = [];
    this.componentData$ = [];
    this.arePendings = [];
  }
  // onUpdate(filters: any[] = [], i: number) {
  //   const queryFilter = {};

  //   for (const filter of filters) {
  //     queryFilter[filter.key] = filter.value;
  //   }

  //   this.refreshSubjects$[i].next(queryFilter);
  // }

  // saveComponentStyles() {
  //   localStorage.removeItem(this.muuriItemsLocalStorageKey);
  //   localStorage.setItem(this.muuriItemsLocalStorageKey, JSON.stringify(this.muuriItemStyles));
  // }

  // zIndexOnHover(value: boolean, i: number){
  //  if (value) {
  //   this.muuriItemStyles[i]["z-index"] = 1000;
    
  //  }
  //  else{
  //   this.muuriItemStyles[i]["z-index"] = 1;

  //  }
  // }

  // onGridCreated(grid: Grid) {
  //   setTimeout(() => {

  //     if (this.refreshedItems) {
  //       grid.refreshItems().layout();
  //     }

  //     const itemIds = grid.getItems().map((item) => {
  //       return item.getElement().getAttribute("id");
  //     });

  //     let layout= this.getLayout();

  //     if (layout) {
  //       console.log("bura gelirmi");
  //       if ((itemIds.length> layout.length)) {
  //         for (let i = (layout.length); i < itemIds.length; i++) {
  //           layout.push(itemIds[i]);  
  //         }  
  //       }
  //       this.loadLayout(grid, layout);
  //     }
  //     else {
  //       grid.layout(true);
  //     }
        
  //     grid.on("move", () => {
  //       this.saveLayout(grid);
  //     });
  //   }, 500);
  // }

  // serializeLayout(grid: Grid) {
  //   const itemIds = grid.getItems().map((item) => {
  //     return item.getElement().getAttribute("id");
  //   });
  //   return JSON.stringify(itemIds);
  // }

  // saveLayout(grid: Grid) {
  //   const layout = this.serializeLayout(grid);
    
  //   localStorage.setItem(this.muuriItemPositionLocalStorageKey, layout);
    
  // }

  // loadLayout(grid: Grid, serializedLayout) {
    
  //   const currentItems = grid.getItems();
  //   const currentItemIds = currentItems.map((item) =>
  //     item.getElement().getAttribute("id")
  //   );

  //   let newItems = [];
  //   serializedLayout.forEach((itemId) => {
  //     let itemIndex = currentItemIds.indexOf(itemId);
  //     if (itemIndex > -1) {
  //       newItems.push(currentItems[itemIndex]);
  //     }
  //   });
  //   grid.sort(newItems, { layout: "instant" });
  //   this.grid = grid;

  // }


  // getLayout() {

  //   const denem = localStorage.getItem(this.muuriItemPositionLocalStorageKey);

  //   const datadeneme = JSON.parse(denem);

  //   return datadeneme;
  // }


  // loadComponentStyles(componentsLength: number) {
  //   let muuriGridItemSavedStyles: any = localStorage.getItem(this.muuriItemsLocalStorageKey);

  //   try {
  //     muuriGridItemSavedStyles = JSON.parse(muuriGridItemSavedStyles) || this.getDefaultComponentStyles(componentsLength);
  //   } catch (e) {
  //     muuriGridItemSavedStyles = [];
  //   }

  //   this.muuriItemStyles = muuriGridItemSavedStyles;

  //   // user might have added new component to dashboard
  //   if (componentsLength > this.muuriItemStyles.length) {
  //     const diff = componentsLength - this.muuriItemStyles.length;
  //     const addedComponentStyles = this.getDefaultComponentStyles(
  //       diff,
  //       this.muuriItemStyles.length
  //     );

  //     this.muuriItemStyles.push(...addedComponentStyles);
  //   }
  // }
  // getDefaultComponentStyles(componentsLength: number, minZIndex: number = 0) {
  //   return new Array(componentsLength).fill(undefined).map((_, i) => {
  //     return {
  //       "width": "240px",
  //       "height": "240px",
  //       "z-index": 1

  //     };
  //   });
  // }

  getMockData(type: string, index: number){

   let mockdata = JSON.parse(this.dashboardService.getExample(type));

   if(index>=0 && index< this.mockData.length){
    this.mockData[index]=mockdata;
   }
   else{
    this.mockData.push(mockdata);
   }
      
  }

  saveMockData(){
    localStorage.removeItem(this.mockDataLocalStorageKey);
    localStorage.setItem(this.mockDataLocalStorageKey, JSON.stringify(this.mockData));
  }

  showExample(type: string) {
    const example = this.dashboardService.getExample(type);
  
    this.dialog.open(ExampleComponent, {
      width: "50%",
      data: {
        code: example
      }
    });
  }

  ngOnDestroy() {
    this.onDestroy$.next();
  }

 

  save() {
    const upsert = this.dashboard._id
      ? this.dashboardService.update(this.dashboard)
      : this.dashboardService.insert(this.dashboard);
    upsert.toPromise().then(() => this.router.navigate(["dashboards"]));
 


  }

  addComponent() {
    this.dashboard.components.push({ name: undefined, url: undefined, type: undefined, ratio: undefined });
    // this.onGridCreated(this.grid);
    

  }
}
