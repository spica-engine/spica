import { Component, OnInit, Input } from "@angular/core";

import { Observable, BehaviorSubject } from "rxjs";
import { Dashboard, getEmptyDashboard } from "@spica-client/dashboard/interfaces";
import { filter, map, switchMap, take, tap, takeUntil } from "rxjs/operators";
import { DashboardService } from "@spica-client/dashboard/services/dashboard.service";
import { ActivatedRoute, Router } from "@angular/router"
import { GridOptions } from 'muuri';
import Grid from 'muuri';
import { deepCopy } from "@spica-client/core";


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

export class DashboardLayout implements OnInit {

    constructor(
        private router: Router,
        private activatedRoute: ActivatedRoute,
        private dashboardService: DashboardService,
    ){}

  muuriItemPositionLocalStorageKey: string;
  muuriItemsLocalStorageKey: string;
  muuriItemStyles: MuuriItemStyles[] = [];
  refreshedItems:boolean = false;

  

  @Input() dashboard$: Observable<Dashboard>;

  @Input() dashboard: Dashboard = getEmptyDashboard();

  @Input() deneme: Dashboard = getEmptyDashboard();// sil

  @Input() ratio: string = "";
  
  @Input() mockData;

  @Input() dash;

  @Input() draggable: boolean;

  refreshSubjects$: BehaviorSubject<any>[] = [];

  componentData$: Observable<object>[] = [];
  
  arePendings: boolean[] = [];

  defaultTypes = ["line", "pie", "doughnut", "polarArea", "scatter", "bubble", "radar", "bar"];

  customTypes = ["table", "card", "statistic"];

  grid:any;

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

    ngOnInit(){


        console.log("layout dashboard", this.dashboard);
      

        this.muuriItemsLocalStorageKey = `dashboard_${this.dashboard._id}_muuri_griditem_styles`;
      
        this.muuriItemPositionLocalStorageKey = `dashboard_${this.dashboard._id}_muuriItemLayouts`;
        
        this.loadComponentStyles(this.dashboard.components.length);
        this.saveComponentStyles();

        for (const [index, component] of this.dashboard.components.entries()) {
          const refresh$ = new BehaviorSubject(undefined);
          this.refreshSubjects$.push(refresh$);

          this.arePendings.push(true);

          this.componentData$.push(
            refresh$.pipe(
              tap(() => (this.arePendings[index] = true)),
              switchMap(filter => this.dashboardService.executeComponent(component.url, filter)),
              tap(() => (this.arePendings[index] = false))
            )
          );
          
        }

        // this.dashboard$ = this.activatedRoute.params.pipe(
        //     switchMap(params =>
        //       this.dashboardService.findOne(params.id).pipe(
        //         tap(dashboard => {
        //           if (!dashboard || !dashboard.components) {
        //             return;
        //           }
      
        //           this.dashboard= deepCopy(dashboard)
        //           this.muuriItemsLocalStorageKey = `dashboard_${dashboard._id}_muuri_griditem_styles`;
      
        //           this.muuriItemPositionLocalStorageKey = `dashboard_${dashboard._id}_muuriItemLayouts`;
      
        //           console.log("typeof dashboard", typeof dashboard._id );
                  

        //           this.loadComponentStyles(dashboard.components.length);
        //           this.saveComponentStyles();
                    
        //           for (const [index, component] of dashboard.components.entries()) {
        //             const refresh$ = new BehaviorSubject(undefined);
        //             this.refreshSubjects$.push(refresh$);
      
      
        //             this.componentData$.push(
        //               refresh$.pipe(
        //                 tap(() => (this.arePendings[index] = true)),
        //                 switchMap(filter => this.dashboardService.executeComponent(component.url, filter)),
        //                 tap(() => (this.arePendings[index] = false))
        //               )
        //             );
                    
        //           }
                  
        //         })
        //       )
        //     )
        //   );
         
      
    }

 
    
      zIndexOnHover(value: boolean, i: number){
       if (value) {
        this.muuriItemStyles[i]["z-index"] = 1000;
        
       }
       else{
        this.muuriItemStyles[i]["z-index"] = 1;
    
       }
      }
    
      onGrid(ratio: string, i: number) {
        
        const parent = document.querySelectorAll(".item");
    
        const itemWitdh = 240;
        const itemHeight = 240;
    
        const column = parseInt(ratio.slice(0, 1));
        const row = parseInt(ratio.slice(2, 3));
    
        if (!parent[i]) {
          return;
        }
        else {
          this.muuriItemStyles[i].height = (itemHeight * row) + "px";
          this.muuriItemStyles[i].width = (itemWitdh * column) +"px";
          this.refreshedItems=true;
          this.onGridCreated(this.grid);
        }
    
        this.saveComponentStyles();
    
      }

      onGridCreated(grid: Grid) {

        // local storaga layout sistemi save olmuyor
        console.log("created grid", grid);
        

        if (this.refreshedItems) {
          grid.refreshItems().layout();
        }
  
        const itemIds = grid.getItems().map((item) => {
          return item.getElement().getAttribute("id");
        });
  
        let layout= this.getLayout();
  
        if (layout) {
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
         this.grid = grid;
      }
    
    
      getLayout() {
    
        const denem = localStorage.getItem(this.muuriItemPositionLocalStorageKey);
    
        const datadeneme = JSON.parse(denem);
    
        return datadeneme;
      }
    
      saveComponentStyles() {
        localStorage.removeItem(this.muuriItemsLocalStorageKey);
        localStorage.setItem(this.muuriItemsLocalStorageKey, JSON.stringify(this.muuriItemStyles));
      }
    
      loadComponentStyles(componentsLength: number) {
        let muuriGridItemSavedStyles: any = localStorage.getItem(this.muuriItemsLocalStorageKey);
    
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
    
}