import {Store} from "@ngrx/store";
import {from, isObservable, Observable, of} from "rxjs";
import {
  bufferCount,
  concatAll,
  concatMap,
  every,
  filter,
  first,
  map,
  switchMap
} from "rxjs/operators";
import {Route, RouteFilter} from "./route";
import {RouteAction, RouteState, selectRoutes} from "./route.reducer";

export class RouteService {
  public readonly routes: Observable<Route[]>;
  constructor(private store: Store<RouteState>, private filters: RouteFilter[]) {
    function wrap<T>(value: T | Promise<T> | Observable<T>) {
      if (isObservable(value)) {
        return value.pipe(first());
      }
      if (value instanceof Promise) {
        return from(Promise.resolve(value));
      }
      return of(value);
    }
    this.routes = store.select(selectRoutes).pipe(
      switchMap(routes =>
        from(routes).pipe(
          concatMap(route =>
            from(this.filters || []).pipe(
              map(filter => wrap(filter.filter(route))),
              concatAll(),
              every(v => v == true),
              map(v => v && route)
            )
          ),
          filter(r => !!r),
          bufferCount(routes.length)
        )
      )
    );
  }

  dispatch(action: RouteAction) {
    this.store.dispatch(action);
  }
}
