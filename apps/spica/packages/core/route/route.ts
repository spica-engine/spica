import {EventEmitter, InjectionToken} from "@angular/core";
import {Observable} from "rxjs";

import {ComponentType} from "@angular/cdk/overlay";
import {AdvancedDrawerComponent} from "@spica-client/core/layout/route/drawers/advanced/advanced.component";
import {BasicDrawerComponent} from "@spica-client/core/layout/route/drawers/basic/basic.component";

export enum RouteCategoryType {
  Dashboard = "Dashboard",
  Developer = "Function",
  Content = "Bucket",
  System = "Access Management",
  Webhook = "Webhook",
  Asset = "Asset",
  Storage = "Storage",

  Content_Sub = "All Buckets",
  Developer_Sub = "Function Logs",
  Webhook_Sub = "Webhook Logs",
  System_Sub = "IA Management",
  Dashboard_Sub = "Dashboards",
  Asset_Sub = "Downloaded Assets",
  Storage_Sub = "Storage_Sub"
}

export interface Route {
  id: string;
  icon: string;
  display: string;
  path: string | ComponentType<any>; // If path is component, can open component in modal
  category: RouteCategoryType;
  data?: {[key: string]: any};
  queryParams?: {[key: string]: any};
  index?: number;
  displayType?: string;
  customClass?: string;
  resource_category?: string;
  draggable?: boolean;
  has_more?: boolean;
}

export interface ViewChange {
  id: string;
  changes: {
    category?: string;
    order?: number;
  };
}

export type RouteCategorySpec = {
  icon: string;
  index: number;
  drawer?: ComponentType<any>;
  props?: {
    moreTemplate?: ComponentType<any>;
    onViewChange?: EventEmitter<ViewChange[]>;
    categoryStorageKey?: RouteCategoryType;
  };
  children: {
    name: RouteCategoryType;
    icon: string;
  };
};

export const routeCategories = new Map<RouteCategoryType, RouteCategorySpec>([
  [
    RouteCategoryType.Dashboard,

    {
      icon: "dashboard",
      index: 1,
      drawer: BasicDrawerComponent,
      children: {name: RouteCategoryType.Dashboard_Sub, icon: "list"}
    }
  ],
  [
    RouteCategoryType.Content,
    {
      icon: "view_stream",
      index: 2,
      drawer: AdvancedDrawerComponent,
      children: {name: RouteCategoryType.Content_Sub, icon: "format_list_numbered"}
    }
  ],
  [
    RouteCategoryType.System,
    {
      icon: "supervisor_account",
      index: 3,
      drawer: BasicDrawerComponent,
      children: {name: RouteCategoryType.System_Sub, icon: "list"}
    }
  ],
  [
    RouteCategoryType.Developer,
    {
      icon: "memory",
      drawer: AdvancedDrawerComponent,
      index: 4,
      children: {name: RouteCategoryType.Developer_Sub, icon: "bug_report"}
    }
  ],
  [
    RouteCategoryType.Webhook,
    {
      icon: "webhook",
      index: 5,
      drawer: BasicDrawerComponent,
      children: {name: RouteCategoryType.Webhook_Sub, icon: "bug_report"}
    }
  ],
  [
    RouteCategoryType.Asset,
    {icon: "shopping_cart", index: 1, children: {name: RouteCategoryType.Asset_Sub, icon: "list"}}
  ],
  [
    RouteCategoryType.Storage,
    {icon: "filter_drama", index: 6, children: {name: RouteCategoryType.Storage_Sub, icon: "list"}}
  ]
]);

export interface RouteFilter {
  filter(route: Route): Promise<boolean> | Observable<boolean> | boolean;
}

export const ROUTE = new InjectionToken<Route>("CORE_ROUTE");

export const ROUTE_FILTERS = new InjectionToken<RouteFilter>("ROUTE_FILTERS");
