import {EventEmitter, InjectionToken} from "@angular/core";
import {Observable} from "rxjs";

import {ComponentType} from "@angular/cdk/overlay";
import {ExpandableNavComponent} from "../layout/expandable-nav/expandable-nav.component";
import {CategoryComponent} from "../layout/category/category.component";

export enum RouteCategoryType {
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
    category: string;
    order: number;
  };
}

export type RouteCategorySpec = {
  icon: string;
  index: number;
  drawer?: ComponentType<any>;
  props?: {
    moreTemplate?: ComponentType<any>;
    onViewChange?: EventEmitter<
      ViewChange[]
    >;
    // Check this key usage, probably its redundant
    categoryStorageKey?: RouteCategoryType;
  };
  children: {
    name: RouteCategoryType;
    icon: string;
  };
};

export const routeCategories: Map<RouteCategoryType, RouteCategorySpec> = new Map<
  RouteCategoryType,
  RouteCategorySpec
>([
  [
    RouteCategoryType.Primary,
    {
      icon: "stars",
      index: 0,
      drawer: ExpandableNavComponent,
      children: {name: RouteCategoryType.Primary_Sub, icon: "list"}
    }
  ],
  [
    RouteCategoryType.Dashboard,

    {
      icon: "dashboard",
      index: 1,
      drawer: ExpandableNavComponent,
      children: {name: RouteCategoryType.Dashboard_Sub, icon: "list"}
    }
  ],
  [
    RouteCategoryType.Content,
    {
      icon: "view_stream",
      index: 2,
      drawer: CategoryComponent,
      children: {name: RouteCategoryType.Content_Sub, icon: "format_list_numbered"}
    }
  ],
  [
    RouteCategoryType.System,
    {
      icon: "supervisor_account",
      index: 3,
      drawer: ExpandableNavComponent,
      children: {name: RouteCategoryType.System_Sub, icon: "list"}
    }
  ],
  [
    RouteCategoryType.Developer,
    {
      icon: "memory",
      drawer: CategoryComponent,
      index: 4,
      children: {name: RouteCategoryType.Developer_Sub, icon: "bug_report"}
    }
  ],
  [
    RouteCategoryType.Webhook,
    {
      icon: "webhook",
      index: 5,
      drawer: ExpandableNavComponent,
      children: {name: RouteCategoryType.Webhook_Sub, icon: "bug_report"}
    }
  ]
]);

export interface RouteFilter {
  filter(route: Route): Promise<boolean> | Observable<boolean> | boolean;
}

export const ROUTE = new InjectionToken<Route>("CORE_ROUTE");

export const ROUTE_FILTERS = new InjectionToken<RouteFilter>("ROUTE_FILTERS");
