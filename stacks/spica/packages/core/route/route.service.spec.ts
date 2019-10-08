import {TestBed} from "@angular/core/testing";
import {StoreModule} from "@ngrx/store";
import {take} from "rxjs/operators";
import {RouteCategory} from "./route";
import {RouteModule} from "./route.module";
import {Add, RemoveCategory, Retrieve, Upsert} from "./route.reducer";
import {RouteService} from "./route.service";

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
      const routes = [{category: RouteCategory.Content, id: "", path: "", icon: "", display: ""}];
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

    it("should clear specified category", done => {
      const routes = [
        {category: RouteCategory.Content, id: "1", path: "", icon: "", display: ""},
        {category: RouteCategory.Developer, id: "2", path: "", icon: "", display: ""}
      ];
      routeService.dispatch(new Retrieve(routes));
      routeService.dispatch(new RemoveCategory(RouteCategory.Developer));
      routeService.routes.pipe(take(1)).subscribe(r => {
        expect(r).toEqual([
          {category: RouteCategory.Content, id: "1", path: "", icon: "", display: ""}
        ]);
        done();
      });
    });

    fit("should upsert existing category", done => {
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
});
