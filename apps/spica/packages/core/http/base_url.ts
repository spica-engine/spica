import {HTTP_INTERCEPTORS} from "@angular/common/http";
import {Inject, InjectionToken, ModuleWithProviders, NgModule, Optional} from "@angular/core";
import {BaseUrlInterceptor} from "./base_url.interceptor";

@NgModule({})
export class BaseUrlInterceptorModule {
  static forRoot(baseCollection: BaseUrlCollection): ModuleWithProviders<BaseUrlInterceptorModule> {
    return {
      ngModule: BaseUrlInterceptorModule,
      providers: [
        {provide: BASE_URL, multi: true, useValue: baseCollection},
        {
          provide: HTTP_INTERCEPTORS,
          multi: true,
          useFactory: provideBaseUrlInterceptor,
          deps: [[new Inject(BASE_URL), new Optional()]]
        }
      ]
    };
  }
}

export const BASE_URL = new InjectionToken<BaseUrlCollection>("BASE_URL");

export interface BaseUrlCollection {
  [key: string]: string;
}

export function provideBaseUrlInterceptor(
  baseCollections: BaseUrlCollection[]
): BaseUrlInterceptor {
  const baseCollection = baseCollections.reduce((mergedCollection, collection) => ({
    ...mergedCollection,
    ...collection
  }));
  return new BaseUrlInterceptor(baseCollection);
}
