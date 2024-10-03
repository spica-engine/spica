import {createEntityAdapter, EntityState} from "@ngrx/entity";
import {Action, createFeatureSelector, createSelector} from "@ngrx/store";
import {Dashboard} from "../interfaces";

export enum DashboardActionTypes {
  RETRIEVE = "DASHBOARD_RETRIEVE",
  ADD = "DASHBOARD_ADD",
  UPDATE = "DASHBOARD_UPDATE",
  REMOVE = "DASHBOARD_REMOVE"
}

export class Retrieve implements Action {
  public readonly type = DashboardActionTypes.RETRIEVE;
  constructor(public dashboards: Dashboard[]) {}
}

export class Remove implements Action {
  readonly type = DashboardActionTypes.REMOVE;
  constructor(public id: string) {}
}

export class Update implements Action {
  readonly type = DashboardActionTypes.UPDATE;
  constructor(public dashboard: Dashboard) {}
}

export class Add implements Action {
  readonly type = DashboardActionTypes.ADD;
  constructor(public dashboard: Dashboard) {}
}

export type DashboardAction = Retrieve | Remove | Add | Update;

export interface State extends EntityState<Dashboard> {
  loaded: boolean;
}
export const adapter = createEntityAdapter<Dashboard>({selectId: dashboard => dashboard._id});

export const initialState: State = adapter.getInitialState({loaded: false});

export function reducer(state: State = initialState, action: DashboardAction): State {
  switch (action.type) {
    case DashboardActionTypes.RETRIEVE:
      return adapter.addAll(action.dashboards, {...state, loaded: true});
    case DashboardActionTypes.REMOVE:
      return adapter.removeOne(action.id, state);
    case DashboardActionTypes.ADD:
      return adapter.addOne(action.dashboard, state);
    case DashboardActionTypes.UPDATE:
      return adapter.setOne(action.dashboard, state);
    default:
      return state;
  }
}

export const dashboardFeatureSelector = createFeatureSelector<State>("dashboard");

export const {selectIds, selectEntities, selectAll, selectTotal} = adapter.getSelectors(
  dashboardFeatureSelector
);

export const selectLoaded = createSelector(
  dashboardFeatureSelector,
  state => state.loaded
);

export const selectEmpty = createSelector(
  dashboardFeatureSelector,
  selectTotal,
  (state, total) => {
    return state.loaded && total == 0;
  }
);

export const selectName = (id: string) =>
  createSelector(
    dashboardFeatureSelector,
    state => state.entities && state.entities[id] && state.entities[id].name
  );

export const selectEntity = (id: string) =>
  createSelector(
    selectEntities,
    state => state && state[id]
  );
