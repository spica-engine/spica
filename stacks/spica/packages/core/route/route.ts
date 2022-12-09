import {InjectionToken} from "@angular/core";
import {Observable} from "rxjs";

import {ComponentType} from "@angular/cdk/overlay";

export enum RouteCategory {
  Dashboard = "Dashboard",
  Primary = "Primary",
  Developer = "Function",
  Content = "Bucket",
  System = "Access Management",
  Webhook = "Webhook",

  Primary_Sub = "Settings",
  Content_Sub = "All Buckets",
  Developer_Sub = "Function Logs",
  Webhook_Sub = "Webhook Logs",
  System_Sub = "IA Management",
  Dashboard_Sub = "Dashboards"
}

export interface Route {
  id: string;
  icon: string;
  display: string;
  path: string | ComponentType<any>; // If path is component, can open component in modal
  category: RouteCategory;
  data?: {[key: string]: any};
  queryParams?: {[key: string]: any};
  index?: number;
  displayType?: string;
  customClass?: string;
  resource_category?: string;
}

export interface RouteFilter {
  filter(route: Route): Promise<boolean> | Observable<boolean> | boolean;
}

export const ROUTE = new InjectionToken<Route>("CORE_ROUTE");

export const ROUTE_FILTERS = new InjectionToken<RouteFilter>("ROUTE_FILTERS");
