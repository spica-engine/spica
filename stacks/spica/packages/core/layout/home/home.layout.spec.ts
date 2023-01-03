import { BreakpointObserver } from "@angular/cdk/layout";
import { ANALYZE_FOR_ENTRY_COMPONENTS, Component, ComponentFactoryResolver } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { MatIconModule } from "@angular/material/icon";
import { MatListModule } from "@angular/material/list";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatToolbarModule } from "@angular/material/toolbar";
import { By } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { RouterTestingModule } from "@angular/router/testing";
import { StoreModule } from "@ngrx/store";
import { of } from "rxjs";
import { RouteCategory, RouteModule } from "../../route";
import { Retrieve } from "../../route/route.reducer";
import { RouteService } from "../../route/route.service";
import { LAYOUT_ACTIONS, LAYOUT_INITIALIZER } from "../config";
import { ToolbarActionDirective } from "../toolbar-action";
import { HomeLayoutComponent } from "./home.layout";
import { CanInteractDirectiveTest } from "@spica-client/passport/directives/can-interact.directive";
import { MatMenuModule } from "@angular/material/menu";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ExpandableNavComponent } from "../expandable-nav/expandable-nav.component";
import { CategoryComponent } from "../category/category.component";

describe("Home Layout", () => {
  describe("test for categories, routes", () => {
    let component: HomeLayoutComponent;
    let fixture: ComponentFixture<HomeLayoutComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        declarations: [HomeLayoutComponent, ToolbarActionDirective, CanInteractDirectiveTest, ExpandableNavComponent, CategoryComponent],
        imports: [
          MatTooltipModule,
          MatSidenavModule,
          MatListModule,
          MatIconModule,
          MatMenuModule,
          MatToolbarModule,
          RouterTestingModule,
          BrowserAnimationsModule,
          StoreModule.forRoot({}),
          RouteModule.forRoot()
        ],
        providers: [ComponentFactoryResolver]
      }).compileComponents();
      fixture = TestBed.createComponent(HomeLayoutComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it("should create component", () => {
      expect(component).toBeTruthy();
    });

    it("should show categories that include first one is selected as default if theres route", fakeAsync(() => {
      TestBed.get(RouteService).dispatch(
        new Retrieve([
          { category: RouteCategory.System, id: "9", path: "", icon: "", display: "system1" },
          { category: RouteCategory.System, id: "0", path: "", icon: "", display: "system2" },
          { category: RouteCategory.Developer, id: "3", path: "", icon: "", display: "developer1" },
          { category: RouteCategory.Developer, id: "4", path: "", icon: "", display: "developer2" },
          { category: RouteCategory.Content, id: "7", path: "", icon: "", display: "content1" },
          { category: RouteCategory.Content, id: "8", path: "", icon: "", display: "content2" },
          { category: RouteCategory.Primary, id: "5", path: "", icon: "", display: "primary1" },
          { category: RouteCategory.Primary, id: "6", path: "", icon: "", display: "primary2" },
          { category: RouteCategory.Webhook, id: "10", path: "", icon: "", display: "webhook1" },
          { category: RouteCategory.Webhook, id: "11", path: "", icon: "", display: "webhook2" },
          { category: RouteCategory.Dashboard, id: "12", path: "", icon: "", display: "dashboard1" },
          { category: RouteCategory.Dashboard, id: "13", path: "", icon: "", display: "dashboard2" }
        ])
      );
      tick(200);
      fixture.detectChanges();
      const navCategories = fixture.debugElement.nativeElement.querySelectorAll(
        ".iconlist > mat-list-item:not(:first-of-type)"
      );
      expect(navCategories.length).toBe(8);
      expect(navCategories[0].getAttribute("class")).toContain("active");
    }));

    it("should show clicked category as active with child routes", fakeAsync(() => {
      TestBed.get(RouteService).dispatch(
        new Retrieve([
          { category: RouteCategory.System, id: "9", path: "", icon: "", display: "system1" },
          { category: RouteCategory.System, id: "0", path: "", icon: "", display: "system2" },
          { category: RouteCategory.Developer, id: "3", path: "", icon: "", display: "developer1" },
          { category: RouteCategory.Developer, id: "4", path: "", icon: "", display: "developer2" },
          { category: RouteCategory.Content, id: "7", path: "", icon: "", display: "content1" },
          { category: RouteCategory.Content, id: "8", path: "", icon: "", display: "content2" },
          { category: RouteCategory.Primary, id: "5", path: "", icon: "", display: "primary1" },
          { category: RouteCategory.Primary, id: "6", path: "", icon: "", display: "primary2" },
          { category: RouteCategory.Webhook, id: "10", path: "", icon: "", display: "webhook1" },
          { category: RouteCategory.Webhook, id: "11", path: "", icon: "", display: "webhook2" },
          { category: RouteCategory.Dashboard, id: "12", path: "", icon: "", display: "dashboard1" },
          { category: RouteCategory.Dashboard, id: "13", path: "", icon: "", display: "dashboard2" }
        ])
      );
      tick(500);
      fixture.detectChanges();
      const contentCategory = fixture.debugElement.nativeElement.querySelectorAll(
        ".iconlist > mat-list-item:not(:first-of-type)"
      )[1];
      contentCategory.click();
      fixture.detectChanges();
      fixture.whenStable().then(() => {
        const selectedCategoryRoutes = fixture.debugElement.nativeElement.querySelectorAll(
          ".routerlist mat-list-item"
        );
        console.log("selectedCategoryRoutes -----******************------------- :", fixture.debugElement.nativeElement.querySelectorAll(".routerlist"), selectedCategoryRoutes)

        expect(selectedCategoryRoutes.length).toEqual(2);
        expect(selectedCategoryRoutes[0].textContent).toEqual(" dashboard1 ");
        expect(selectedCategoryRoutes[1].textContent).toEqual(" dashboard2 ");
      })
    }));

    it("should show sub menu", fakeAsync(() => {
      TestBed.get(RouteService).dispatch(
        new Retrieve([
          {
            category: RouteCategory.Primary,
            id: "9",
            path: "",
            icon: "",
            display: "system1",
            displayType: "menu"
          },
          {
            category: RouteCategory.Primary,
            id: "0",
            path: "",
            icon: "",
            display: "system2",
            displayType: "menu"
          },
          {
            category: RouteCategory.Primary_Sub,
            id: "3",
            path: "",
            icon: "",
            display: "sub1",
            displayType: "menu"
          },
          {
            category: RouteCategory.Primary_Sub,
            id: "4",
            path: "",
            icon: "",
            display: "sub2",
            displayType: "menu"
          }
        ])
      );
      tick(200);
      fixture.detectChanges();
      const matMenu = fixture.debugElement.nativeElement.querySelectorAll(
        "h4 .subcategory-items mat-menu"
      );
      expect(matMenu.length).toEqual(1);
    }));

    it("should show action button instead of mat menu", fakeAsync(() => {
      TestBed.get(RouteService).dispatch(
        new Retrieve([
          { category: RouteCategory.Primary, id: "9", path: "", icon: "", display: "system1" },
          { category: RouteCategory.Primary_Sub, id: "3", path: "", icon: "", display: "sub1" }
        ])
      );
      tick(200);
      fixture.detectChanges();
      const matMenu = fixture.debugElement.nativeElement.querySelectorAll(
        "h4 .subcategory-items mat-menu"
      );
      expect(matMenu.length).toEqual(0);
      const actionButton = fixture.debugElement.nativeElement.querySelectorAll(
        "h4 .subcategory-items button"
      );
      expect(actionButton.length).toEqual(1);
    }));
  });

  describe("test for ishandset value when its true as default", () => {
    let component: HomeLayoutComponent;
    let fixture: ComponentFixture<HomeLayoutComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        declarations: [HomeLayoutComponent, ToolbarActionDirective,ExpandableNavComponent,CategoryComponent, CanInteractDirectiveTest],
        imports: [
          MatSidenavModule,
          MatListModule,
          MatIconModule,
          MatToolbarModule,
          RouterTestingModule,
          BrowserAnimationsModule,
          StoreModule.forRoot({}),
          RouteModule.forRoot()
        ],
        providers: [
          ComponentFactoryResolver,
          {
            provide: BreakpointObserver,
            useValue: {
              observe: jasmine.createSpy("observe").and.returnValue(of({ matches: true }))
            }
          }
        ]
      }).compileComponents();
      fixture = TestBed.createComponent(HomeLayoutComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it("should create component", () => {
      expect(component).toBeDefined();
    });

    it("should render closed sidenav", fakeAsync(() => {
      const sideNav = fixture.debugElement.nativeElement.querySelector("mat-sidenav");
      expect(sideNav.getAttribute("ng-reflect-opened")).toBe("false");
      expect(sideNav.getAttribute("ng-reflect-mode")).toBe("over");
      expect(sideNav.getAttribute("role")).toBe("dialog");
      expect(sideNav.getAttribute("style")).toContain("visibility: hidden");
    }));

    it("should open sidenav", fakeAsync(() => {
      TestBed.get(RouteService).dispatch(
        new Retrieve([
          { category: RouteCategory.System, id: "9", path: "", icon: "", display: "system1" }
        ])
      );
      const toolbarButton = fixture.debugElement.nativeElement.querySelector(
        "mat-toolbar > button"
      );
      toolbarButton.click();
      tick(200)
      fixture.detectChanges();
      const sideNav = fixture.debugElement.nativeElement.querySelector("mat-sidenav");
      expect(sideNav.getAttribute("style")).not.toContain("visibility:hidden");
    }));
  });

  describe("test for ishandset value when its false as default", () => {
    let component: HomeLayoutComponent;
    let fixture: ComponentFixture<HomeLayoutComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        declarations: [HomeLayoutComponent, ToolbarActionDirective, CanInteractDirectiveTest],
        imports: [
          MatSidenavModule,
          MatListModule,
          MatIconModule,
          MatToolbarModule,
          RouterTestingModule,
          BrowserAnimationsModule,
          StoreModule.forRoot({}),
          RouteModule.forRoot()
        ],
        providers: [
          {
            provide: BreakpointObserver,
            useValue: {
              observe: jasmine.createSpy("observe").and.returnValue(of({ matches: false }))
            }
          }
        ]
      }).compileComponents();
      fixture = TestBed.createComponent(HomeLayoutComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it("should create component", () => {
      expect(component).toBeDefined();
    });

    it("should render opened sidenav", fakeAsync(() => {
      const sideNav = fixture.debugElement.nativeElement.querySelector("mat-sidenav");
      expect(sideNav.getAttribute("ng-reflect-opened")).toBe("true");
      expect(sideNav.getAttribute("ng-reflect-mode")).toBe("side");
      expect(sideNav.getAttribute("role")).toBe("navigation");
    }));
  });

  describe("should work with layout actions", () => {
    @Component({
      selector: "dummy-action",
      template: "<button>BUTTON</button>"
    })
    class DummyAction { }

    let component: HomeLayoutComponent;
    let fixture: ComponentFixture<HomeLayoutComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        declarations: [
          HomeLayoutComponent,
          DummyAction,
          ToolbarActionDirective,
          CanInteractDirectiveTest
        ],
        imports: [
          MatSidenavModule,
          MatListModule,
          MatIconModule,
          MatToolbarModule,
          RouterTestingModule,
          BrowserAnimationsModule,
          StoreModule.forRoot({}),
          RouteModule.forRoot()
        ],
        providers: [
          {
            provide: LAYOUT_ACTIONS,
            useValue: DummyAction,
            multi: true
          },
          {
            provide: ANALYZE_FOR_ENTRY_COMPONENTS,
            useValue: DummyAction,
            multi: true
          }
        ]
      }).compileComponents();
      fixture = TestBed.createComponent(HomeLayoutComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it("should create component", () => {
      expect(component).toBeTruthy();
    });
  });

  describe("should work with layout initializer", () => {
    let component: HomeLayoutComponent;
    let fixture: ComponentFixture<HomeLayoutComponent>;

    let spy = jasmine.createSpy("test");

    beforeEach(() => {
      TestBed.configureTestingModule({
        declarations: [HomeLayoutComponent, ToolbarActionDirective, CanInteractDirectiveTest],
        imports: [
          MatSidenavModule,
          MatListModule,
          MatIconModule,
          MatToolbarModule,
          RouterTestingModule,
          BrowserAnimationsModule,
          StoreModule.forRoot({}),
          RouteModule.forRoot()
        ],
        providers: [
          {
            provide: LAYOUT_INITIALIZER,
            useValue: spy,
            multi: true
          }
        ]
      }).compileComponents();
      fixture = TestBed.createComponent(HomeLayoutComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it("should create component and call functions", () => {
      expect(component).toBeDefined();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
