import {
  APP_BOOTSTRAP_LISTENER,
  Inject,
  ModuleWithProviders,
  NgModule,
  Optional
} from "@angular/core";
import {Store, StoreModule} from "@ngrx/store";
import {CategoryService} from "./category";
import {Route, ROUTE, ROUTE_FILTERS} from "./route";
import {RouteInitializer} from "./route.initializer";
import {reducer} from "./route.reducer";
import {RouteService} from "./route.service";

@NgModule({imports: [StoreModule.forFeature("routes", reducer)]})
export class RouteModule {
  static forRoot(): ModuleWithProviders<RouteModule> {
    return {
      ngModule: RouteModule,
      providers: [
        {
          provide: RouteInitializer,
          useClass: RouteInitializer,
          deps: [RouteService, [new Inject(ROUTE), new Optional()]]
        },
        {
          provide: APP_BOOTSTRAP_LISTENER,
          multi: true,
          useFactory: routeInitializer,
          deps: [RouteInitializer]
        },
        {
          provide: RouteService,
          useClass: RouteService,
          deps: [Store, [ROUTE_FILTERS, new Optional()]]
        },
        {
          provide: CategoryService,
          useClass: CategoryService
        }
      ]
    };
  }
  static forChild(routes: Route[]): ModuleWithProviders<RouteModule> {
    return {ngModule: RouteModule, providers: [{provide: ROUTE, multi: true, useValue: routes}]};
  }
}

export function routeInitializer(initializer: RouteInitializer): Function {
  return initializer.initialize.bind(initializer);
}
