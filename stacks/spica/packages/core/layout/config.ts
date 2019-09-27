import {InjectionToken} from "@angular/core";

export interface LayoutConfig {
  defaultLayout?: any;
}

export const DEFAULT_LAYOUT = new InjectionToken<any>("PRIMARY_LAYOUT");
export const LAYOUT_ACTIONS = new InjectionToken<any>("LAYOUT_ACTIONS");

export const LAYOUT_INITIALIZER = new InjectionToken<any>("LAYOUT_INITIALIZER");
