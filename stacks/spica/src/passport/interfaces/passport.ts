import {InjectionToken} from "@angular/core";

export interface PassportOptions {
  url: string;
}
export const PASSPORT_OPTIONS = new InjectionToken<PassportOptions>("PASSPORT_OPTIONS");
