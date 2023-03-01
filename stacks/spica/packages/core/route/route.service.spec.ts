import {TestBed, tick, fakeAsync} from "@angular/core/testing";
import {StoreModule} from "@ngrx/store";
import {take} from "rxjs/operators";
import {RouteCategory, RouteFilter, Route, ROUTE_FILTERS} from "./route";
import {RouteModule} from "./route.module";
import {Add, RemoveCategory, Retrieve, Upsert, Remove} from "./route.reducer";
import {RouteService} from "./route.service";
import {Observable} from "rxjs";

describe("RouteService", () => {
  describe("without filters", () => {
    let routeService: RouteService;

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [StoreModule.forRoot({}), RouteModule.forRoot()]
      });
      routeService = TestBed.get(RouteService) as RouteService;
    });

    it("should dispatch full routes on retrieve", done => {
      const routes = [
        {category: RouteCategory.Content, id: "1", path: "", icon: "", display: ""},
        {category: RouteCategory.Developer, id: "2", path: "", icon: "", display: ""},
        {category: RouteCategory.System, id: "4", path: "", icon: "", display: ""}
      ];
      routeService.dispatch(new Retrieve(routes));
      routeService.routes.pipe(take(1)).subscribe(r => {
        expect(r).toEqual(routes);
        done();
      });
    });

    it("should dispatch previous routes and new added", done => {
      const routes = [{category: RouteCategory.Content, id: "", path: "", icon: "", display: ""}];
      const laterAddedRoute = {
        category: RouteCategory.Developer,
        id: "123",
        path: "",
        icon: "",
        display: ""
      };
      routeService.dispatch(new Retrieve(routes));
      routeService.dispatch(new Add(laterAddedRoute));
      routeService.routes.pipe(take(1)).subscribe(r => {
        expect(r).toEqual([
          {category: RouteCategory.Content, id: "", path: "", icon: "", display: ""},
          {
            category: RouteCategory.Developer,
            id: "123",
            path: "",
            icon: "",
            display: ""
          }
        ]);
        done();
      });
    });

    it("should clear route(s) specified category", done => {
      const routes = [
        {category: RouteCategory.Content, id: "1", path: "", icon: "", display: ""},
        {category: RouteCategory.Content, id: "5", path: "", icon: "", display: ""},
        {category: RouteCategory.Developer, id: "2", path: "", icon: "", display: ""},
        {category: RouteCategory.Developer, id: "3", path: "", icon: "", display: ""},
        {category: RouteCategory.Developer, id: "4", path: "", icon: "", display: ""}
      ];
      routeService.dispatch(new Retrieve(routes));
      routeService.dispatch(new RemoveCategory(RouteCategory.Content));
      routeService.routes.pipe(take(1)).subscribe(r => {
        expect(r).toEqual([
          {category: RouteCategory.Developer, id: "2", path: "", icon: "", display: ""},
          {category: RouteCategory.Developer, id: "3", path: "", icon: "", display: ""},
          {category: RouteCategory.Developer, id: "4", path: "", icon: "", display: ""}
        ]);
        done();
      });
    });
    it("should clear route specified id", done => {
      const routes = [
        {category: RouteCategory.Content, id: "1", path: "", icon: "", display: ""},
        {category: RouteCategory.Content, id: "5", path: "", icon: "", display: ""},
        {category: RouteCategory.Developer, id: "2", path: "", icon: "", display: ""},
        {category: RouteCategory.Developer, id: "3", path: "", icon: "", display: ""},
        {category: RouteCategory.Developer, id: "4", path: "", icon: "", display: ""}
      ];
      routeService.dispatch(new Retrieve(routes));
      routeService.dispatch(new Remove("1"));
      routeService.routes.pipe(take(1)).subscribe(r => {
        expect(r).toEqual([
          {category: RouteCategory.Content, id: "5", path: "", icon: "", display: ""},
          {category: RouteCategory.Developer, id: "2", path: "", icon: "", display: ""},
          {category: RouteCategory.Developer, id: "3", path: "", icon: "", display: ""},
          {category: RouteCategory.Developer, id: "4", path: "", icon: "", display: ""}
        ]);
        done();
      });
    });

    it("should upsert existing category", done => {
      const route = {category: RouteCategory.Content, id: "1", path: "", icon: "", display: ""};
      const changedRoute = {
        category: RouteCategory.Content,
        id: "1",
        path: "",
        icon: "",
        display: "123"
      };
      routeService.dispatch(new Retrieve([route]));
      routeService.dispatch(new Upsert(changedRoute));
      routeService.routes.pipe(take(1)).subscribe(r => {
        expect(r).toEqual([changedRoute]);
        done();
      });
    });
  });

  describe("filter which includes specific category", () => {
    let routeService: RouteService;
    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [StoreModule.forRoot({}), RouteModule.forRoot()],
        providers: [
          {
            provide: ROUTE_FILTERS,
            multi: true,
            useValue: new (class implements RouteFilter {
              filter(route: Route): Promise<boolean> | Observable<boolean> | boolean {
                return route.category == RouteCategory.Developer ? true : false;
              }
            })()
          }
        ]
      });
      routeService = TestBed.get(RouteService) as RouteService;
    });
    it("should filter routes which has category Developer", done => {
      const routes = [
        {category: RouteCategory.Content, id: "1", path: "", icon: "", display: ""},
        {category: RouteCategory.Content, id: "2", path: "", icon: "", display: ""},
        {category: RouteCategory.Developer, id: "3", path: "", icon: "", display: ""},
        {category: RouteCategory.Developer, id: "4", path: "", icon: "", display: ""},
        {category: RouteCategory.System, id: "5", path: "", icon: "", display: ""},
        {category: RouteCategory.System, id: "6", path: "", icon: "", display: ""}
      ];

      routeService.dispatch(new Retrieve(routes));
      routeService.routes.subscribe(receivedRoutes => {
        expect(receivedRoutes).toEqual([
          {category: RouteCategory.Developer, id: "3", path: "", icon: "", display: ""},
          {category: RouteCategory.Developer, id: "4", path: "", icon: "", display: ""}
        ]);
        done();
      }, done.fail);
    });
  });

  describe("filter which is not include spesific category", () => {
    let routeService: RouteService;
    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [StoreModule.forRoot({}), RouteModule.forRoot()],
        providers: [
          {
            provide: ROUTE_FILTERS,
            multi: true,
            useValue: new (class implements RouteFilter {
              filter(route: Route): Promise<boolean> | Observable<boolean> | boolean {
                return route.category == RouteCategory.Developer ? false : true;
              }
            })()
          }
        ]
      });
      routeService = TestBed.get(RouteService) as RouteService;
    });
    it("should filter routes which has not category Developer", done => {
      const routes = [
        {category: RouteCategory.Content, id: "1", path: "", icon: "", display: ""},
        {category: RouteCategory.Content, id: "2", path: "", icon: "", display: ""},
        {category: RouteCategory.Developer, id: "3", path: "", icon: "", display: ""},
        {category: RouteCategory.Developer, id: "4", path: "", icon: "", display: ""},
        {category: RouteCategory.System, id: "5", path: "", icon: "", display: ""},
        {category: RouteCategory.System, id: "6", path: "", icon: "", display: ""}
      ];

      routeService.dispatch(new Retrieve(routes));
      routeService.routes.subscribe(receivedRoutes => {
        expect(receivedRoutes).toEqual([
          {category: RouteCategory.Content, id: "1", path: "", icon: "", display: ""},
          {category: RouteCategory.Content, id: "2", path: "", icon: "", display: ""},
          {category: RouteCategory.System, id: "5", path: "", icon: "", display: ""},
          {category: RouteCategory.System, id: "6", path: "", icon: "", display: ""}
        ]);
        done();
      }, done.fail);
    });
  });
});
