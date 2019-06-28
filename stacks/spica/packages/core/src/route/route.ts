import {InjectionToken} from "@angular/core";
import {Observable} from "rxjs";

export enum RouteCategory {
  Primary = "Primary",
  Content = "Content",
  Developer = "Developer",
  System = "System"
}

export interface Route {
  id: string;
  icon: string;
  display: string;
  path: string;
  category: RouteCategory;
  data?: {[key: string]: any};
}

export interface RouteFilter {
  filter(route: Route): Promise<boolean> | Observable<boolean> | boolean;
}

export const ROUTE = new InjectionToken<Route>("CORE_ROUTE");

export const ROUTE_FILTERS = new InjectionToken<RouteFilter>("ROUTE_FILTERS");
