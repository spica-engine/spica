import {createEntityAdapter, EntityState} from "@ngrx/entity";
import {Action, createFeatureSelector, createSelector} from "@ngrx/store";
import {Dashboards} from "../interfaces";

export enum DashboardActionTypes {
  RETRIEVE = "dashboard_RETRIEVE"
}

export class Retrieve implements Action {
  public readonly type = DashboardActionTypes.RETRIEVE;
  constructor(public dashboards: Dashboards[]) {}
}

export type DashboardAction = Retrieve;
export interface State extends EntityState<Dashboards> {
  loaded: boolean;
}
export const adapter = createEntityAdapter<Dashboards>({selectId: dashboard => dashboard.id});

export const initialState: State = adapter.getInitialState({loaded: false});

export function reducer(state: State = initialState, action: DashboardAction): State {
  switch (action.type) {
    case DashboardActionTypes.RETRIEVE:
      return adapter.addAll(action.dashboards, {...state, loaded: true});

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
