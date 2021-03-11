import {InjectionToken} from "@angular/core";
import {Observable} from "rxjs";

export enum RouteCategory {
  Primary = "Primary",
  Content = "Buckets",
  Developer = "Developer Area",
  System = "Access Management",

  Primary_Sub = "Settings",
  Content_Sub = "All Buckets",
  Developer_Sub = "Logs",
  System_Sub = "IA Management"
}

export interface Route {
  id: string;
  icon: string;
  display: string;
  path: string;
  category: RouteCategory;
  data?: {[key: string]: any};
  queryParams?: {[key: string]: any};
  index?: number;
}

export interface RouteFilter {
  filter(route: Route): Promise<boolean> | Observable<boolean> | boolean;
}

export const ROUTE = new InjectionToken<Route>("CORE_ROUTE");

export const ROUTE_FILTERS = new InjectionToken<RouteFilter>("ROUTE_FILTERS");
