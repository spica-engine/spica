import {ɵisObservable as isObservable, ɵisPromise as isPromise} from "@angular/core";
import {from, Observable, of} from "rxjs";

export function wrapIntoObservable<T>(value: T | Promise<T> | Observable<T>): Observable<T> {
  if (isObservable(value)) {
    return value;
  }

  if (isPromise(value)) {
    return from(value);
  }

  return of(value as T);
}
