import {createEntityAdapter, EntityState} from "@ngrx/entity";
import {Action, createFeatureSelector, createSelector} from "@ngrx/store";
import {Route, RouteCategoryType} from "./route";

export enum RouteActionTypes {
  RETRIEVE = "ROUTE_RETRIEVE",
  ADD = "ROUTE_ADD",
  REMOVE = "ROUTE_REMOVE",
  REMOVECATEGORY = "ROUTE_REMOVE_CATEGORY",
  CHERRYPICKANDREMOVE = "ROUTE_CHERRYPICK_AND_REMOVE",
  UPDATE = "ROUTE_UPDATE",
  UPSERT = "ROUTE_UPSERT"
}

export class Add implements Action {
  public readonly type = RouteActionTypes.ADD;
  constructor(public route: Route) {}
}

export class Update implements Action {
  public readonly type = RouteActionTypes.UPDATE;
  constructor(public id: string, public changes: Partial<Route>) {}
}

export class Upsert implements Action {
  public readonly type = RouteActionTypes.UPSERT;
  constructor(public route: Route) {}
}

export class Remove implements Action {
  public readonly type = RouteActionTypes.REMOVE;
  constructor(public id: string) {}
}

export class RemoveCategory implements Action {
  public readonly type = RouteActionTypes.REMOVECATEGORY;
  constructor(public category: RouteCategoryType) {}
}

export class CherryPickAndRemove implements Action {
  public readonly type = RouteActionTypes.CHERRYPICKANDREMOVE;
  constructor(public filterer: (e: Route) => boolean) {}
}

export class Retrieve implements Action {
  public readonly type = RouteActionTypes.RETRIEVE;
  constructor(public routes: Route[]) {}
}

export type RouteAction =
  | Retrieve
  | Add
  | Update
  | Remove
  | Upsert
  | RemoveCategory
  | CherryPickAndRemove;

export interface RouteState extends EntityState<Route> {}

export const adapter = createEntityAdapter<Route>({selectId: route => route.id});

export const initialState: RouteState = adapter.getInitialState({});

export function reducer(state: RouteState = initialState, action: RouteAction): RouteState {
  switch (action.type) {
    case RouteActionTypes.RETRIEVE:
      return adapter.addAll(action.routes, state);
    case RouteActionTypes.ADD:
      return adapter.addOne(action.route, state);
    case RouteActionTypes.REMOVE:
      return adapter.removeOne(action.id, state);
    case RouteActionTypes.REMOVECATEGORY:
      return adapter.removeMany(entity => entity.category == action.category, state);
    case RouteActionTypes.CHERRYPICKANDREMOVE:
      return adapter.removeMany(action.filterer, state);
    case RouteActionTypes.UPDATE:
      return adapter.updateOne({id: action.id, changes: action.changes}, state);
    case RouteActionTypes.UPSERT:
      return adapter.upsertOne(action.route, state);
    default:
      return state;
  }
}

const {selectAll} = adapter.getSelectors();

export const selectRoutes = createSelector(
  createFeatureSelector<RouteState>("routes"),
  selectAll
);
