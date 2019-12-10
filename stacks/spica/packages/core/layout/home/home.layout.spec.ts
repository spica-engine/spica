import {TestBed, ComponentFixture, fakeAsync, tick} from "@angular/core/testing";
import {HomeLayoutComponent} from "./home.layout";
import {MatSidenavModule} from "@angular/material/sidenav";
import {MatListModule} from "@angular/material/list";
import {MatIconModule} from "@angular/material/icon";
import {MatToolbarModule} from "@angular/material/toolbar";
import {RouterTestingModule} from "@angular/router/testing";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {StoreModule} from "@ngrx/store";
import {RouteModule, RouteCategory} from "../../route";
import {RouteService} from "../../route/route.service";
import {Retrieve} from "../../route/route.reducer";
import {BreakpointObserver} from "@angular/cdk/layout";
import {of} from "rxjs";
import {LAYOUT_ACTIONS, LAYOUT_INITIALIZER} from "../config";
import {Component, NgModule, ANALYZE_FOR_ENTRY_COMPONENTS} from "@angular/core";
import {BrowserDynamicTestingModule} from "@angular/platform-browser-dynamic/testing";
import {TestingModule} from "@nestjs/testing";

describe("Home Layout", () => {
  describe("test for categories, routes", () => {
    let component: HomeLayoutComponent;
    let fixture: ComponentFixture<HomeLayoutComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        declarations: [HomeLayoutComponent],
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
        providers: []
      }).compileComponents();
      fixture = TestBed.createComponent(HomeLayoutComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it("should create component", () => {
      expect(component).toBeTruthy();
    });

    it("should not show categories if theres no route", () => {
      const navCategories = fixture.debugElement.nativeElement.querySelectorAll(
        "mat-nav-list:first-of-type > mat-list-item:not(:first-of-type)"
      );

      expect(navCategories.length).toBe(1);
    });

    it("should show categories that include first one is selected as default if theres route", fakeAsync(() => {
      TestBed.get(RouteService).dispatch(
        new Retrieve([
          {category: RouteCategory.System, id: "9", path: "", icon: "", display: "system1"},
          {category: RouteCategory.System, id: "0", path: "", icon: "", display: "system2"},
          {category: RouteCategory.Developer, id: "3", path: "", icon: "", display: "developer1"},
          {category: RouteCategory.Developer, id: "4", path: "", icon: "", display: "developer2"},
          {category: RouteCategory.Content, id: "7", path: "", icon: "", display: "content1"},
          {category: RouteCategory.Content, id: "8", path: "", icon: "", display: "content2"},
          {category: RouteCategory.Primary, id: "5", path: "", icon: "", display: "primary1"},
          {category: RouteCategory.Primary, id: "6", path: "", icon: "", display: "primary2"}
        ])
      );
      tick();
      fixture.detectChanges();
      const navCategories = fixture.debugElement.nativeElement.querySelectorAll(
        "mat-nav-list:first-of-type > mat-list-item:not(:first-of-type)"
      );
      expect(navCategories.length).toBe(5);
      expect(navCategories[0].getAttribute("class")).toContain("active");
    }));

    it("should show clicked category as active with child routes", fakeAsync(() => {
      TestBed.get(RouteService).dispatch(
        new Retrieve([
          {category: RouteCategory.System, id: "9", path: "", icon: "", display: "system1"},
          {category: RouteCategory.System, id: "0", path: "", icon: "", display: "system2"},
          {category: RouteCategory.Developer, id: "3", path: "", icon: "", display: "developer1"},
          {category: RouteCategory.Developer, id: "4", path: "", icon: "", display: "developer2"},
          {category: RouteCategory.Content, id: "7", path: "", icon: "", display: "content1"},
          {category: RouteCategory.Content, id: "8", path: "", icon: "", display: "content2"},
          {category: RouteCategory.Primary, id: "5", path: "", icon: "", display: "primary1"},
          {category: RouteCategory.Primary, id: "6", path: "", icon: "", display: "primary2"}
        ])
      );
      tick();
      fixture.detectChanges();
      const contentCategory = fixture.debugElement.nativeElement.querySelectorAll(
        "mat-nav-list:first-of-type > mat-list-item:not(:first-of-type)"
      )[1];
      contentCategory.click();
      fixture.detectChanges();
      const selectedCategoryTitle = fixture.debugElement.nativeElement.querySelector(
        "mat-nav-list:last-of-type > h4"
      );
      expect(selectedCategoryTitle.textContent).toEqual("Content");
      const selectedCategoryRoutes = fixture.debugElement.nativeElement.querySelectorAll(
        "mat-nav-list:last-of-type > mat-list-item"
      );
      expect(selectedCategoryRoutes.length).toEqual(2);
      expect(selectedCategoryRoutes[0].textContent).toEqual(" content1 ");
      expect(selectedCategoryRoutes[1].textContent).toEqual(" content2 ");
    }));
  });

  describe("test for ishandset value when its true as default", () => {
    let component: HomeLayoutComponent;
    let fixture: ComponentFixture<HomeLayoutComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        declarations: [HomeLayoutComponent],
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
              observe: jasmine.createSpy("observe").and.returnValue(of({matches: true}))
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
      expect(sideNav.getAttribute("style")).toContain("visibility:hidden");
    }));

    it("should open sidenav", fakeAsync(() => {
      TestBed.get(RouteService).dispatch(
        new Retrieve([
          {category: RouteCategory.System, id: "9", path: "", icon: "", display: "system1"}
        ])
      );
      const toolbarButton = fixture.debugElement.nativeElement.querySelector(
        "mat-toolbar > button"
      );
      toolbarButton.click();
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
        declarations: [HomeLayoutComponent],
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
              observe: jasmine.createSpy("observe").and.returnValue(of({matches: false}))
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
    class DummyAction {}

    let component: HomeLayoutComponent;
    let fixture: ComponentFixture<HomeLayoutComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        declarations: [HomeLayoutComponent, DummyAction],
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

    it("should create dummy action layout", () => {
      const layout = fixture.debugElement.nativeElement.querySelector("dummy-action");
      expect(layout).toBeTruthy();
      const button = fixture.debugElement.nativeElement.querySelector("dummy-action > button");
      expect(button).toBeTruthy();
      expect(button.textContent).toBe("BUTTON");
    });
  });

  describe("should work with layout initializer", () => {
    let component: HomeLayoutComponent;
    let fixture: ComponentFixture<HomeLayoutComponent>;

    let spy = jasmine.createSpy("test");

    beforeEach(() => {
      TestBed.configureTestingModule({
        declarations: [HomeLayoutComponent],
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
