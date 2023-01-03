import {InjectionToken} from "@angular/core";
import {Observable} from "rxjs";

import {ComponentType} from "@angular/cdk/overlay";
import {ExpandableNavComponent} from "../layout/expandable-nav/expandable-nav.component";
import {CategoryComponent} from "../layout/category/category.component";

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
  draggable?: boolean;
  has_more?: boolean;
}

export const Root_Categories = new Map<
  RouteCategory,
  {
    icon: string;
    index: number;
    drawer?: ComponentType<any>;
    props?: any;
    children: {
      name: RouteCategory;
      icon: string;
    };
  }
>([
  [
    RouteCategory.Primary,
    {
      icon: "stars",
      index: 0,
      drawer: ExpandableNavComponent,
      props: {},
      children: {name: RouteCategory.Primary_Sub, icon: "list"}
    }
  ],
  [
    RouteCategory.Dashboard,

    {
      icon: "dashboard",
      index: 1,
      drawer: ExpandableNavComponent,
      props: {},
      children: {name: RouteCategory.Dashboard_Sub, icon: "list"}
    }
  ],
  [
    RouteCategory.Content,
    {
      icon: "view_stream",
      index: 2,
      drawer: CategoryComponent,
      children: {name: RouteCategory.Content_Sub, icon: "format_list_numbered"}
    }
  ],
  [
    RouteCategory.System,
    {
      icon: "supervisor_account",
      index: 3,
      drawer: ExpandableNavComponent,
      props: {},
      children: {name: RouteCategory.System_Sub, icon: "list"}
    }
  ],
  [
    RouteCategory.Developer,
    {icon: "memory", index: 4, children: {name: RouteCategory.Developer_Sub, icon: "bug_report"}}
  ],
  [
    RouteCategory.Webhook,
    {
      icon: "webhook",
      index: 5,
      drawer: ExpandableNavComponent,
      props: {},
      children: {name: RouteCategory.Webhook_Sub, icon: "bug_report"}
    }
  ]
]);

export interface RouteFilter {
  filter(route: Route): Promise<boolean> | Observable<boolean> | boolean;
}

export const ROUTE = new InjectionToken<Route>("CORE_ROUTE");

export const ROUTE_FILTERS = new InjectionToken<RouteFilter>("ROUTE_FILTERS");
