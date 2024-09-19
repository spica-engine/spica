import {createEntityAdapter, EntityState} from "@ngrx/entity";
import {Action, createFeatureSelector, createSelector} from "@ngrx/store";
import {Asset} from "../interfaces";

export enum AssetActionTypes {
  RETRIEVE = "ASSET_RETRIEVE",
  ADD = "ASSET_ADD",
  UPDATE = "ASSET_UPDATE",
  REMOVE = "ASSET_REMOVE"
}

export class Retrieve implements Action {
  public readonly type = AssetActionTypes.RETRIEVE;
  constructor(public assets: Asset[]) {}
}

export class Remove implements Action {
  readonly type = AssetActionTypes.REMOVE;
  constructor(public id: string) {}
}

export class Update implements Action {
  readonly type = AssetActionTypes.UPDATE;
  constructor(public id: string, public changes: Partial<Asset>) {}
}

export class Add implements Action {
  readonly type = AssetActionTypes.ADD;
  constructor(public asset: Asset) {}
}

export type AssetAction = Retrieve | Remove | Add | Update;

export interface State extends EntityState<Asset> {
  loaded: boolean;
}
export const adapter = createEntityAdapter<Asset>({selectId: asset => asset._id});

export const initialState: State = adapter.getInitialState({loaded: false});

export function reducer(state: State = initialState, action: AssetAction): State {
  switch (action.type) {
    case AssetActionTypes.RETRIEVE:
      return adapter.setAll(action.assets, {...state, loaded: true});
    case AssetActionTypes.REMOVE:
      return adapter.removeOne(action.id, state);
    case AssetActionTypes.ADD:
      return adapter.addOne(action.asset, state);
    case AssetActionTypes.UPDATE:
      return adapter.updateOne({id: action.id, changes: action.changes}, state);
    default:
      return state;
  }
}

export const assetFeatureSelector = createFeatureSelector<State>("asset");

export const {selectIds, selectEntities, selectAll, selectTotal} = adapter.getSelectors(
  assetFeatureSelector
);

export const selectLoaded = createSelector(
  assetFeatureSelector,
  state => state.loaded
);

export const selectEmpty = createSelector(
  assetFeatureSelector,
  selectTotal,
  (state, total) => {
    return state.loaded && total == 0;
  }
);

export const selectName = (id: string) =>
  createSelector(
    assetFeatureSelector,
    state => state.entities && state.entities[id] && state.entities[id].name
  );

export const selectEntity = (id: string) =>
  createSelector(
    selectEntities,
    state => state && state[id]
  );
