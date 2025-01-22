import {createEntityAdapter, EntityAdapter, EntityState} from "@ngrx/entity";
import {createFeatureSelector, createSelector} from "@ngrx/store";

import {FunctionActions, FunctionActionTypes} from "../actions/function.actions";
import {Function} from "../interface";

export interface State extends EntityState<Function> {
  loaded: boolean;
}

export const adapter: EntityAdapter<Function> = createEntityAdapter<Function>({
  selectId: fn => fn._id,
  sortComparer: (a, b) => a.order - b.order
});

export const initialState: State = adapter.getInitialState({loaded: false});

export function reducer(state = initialState, action: FunctionActions): State {
  switch (action.type) {
    case FunctionActionTypes.AddFunction: {
      return adapter.addOne(action.payload.function, state);
    }

    case FunctionActionTypes.UpsertFunction: {
      return adapter.upsertOne(action.payload.function, state);
    }

    case FunctionActionTypes.AddFunctions: {
      return adapter.addMany(action.payload.functions, state);
    }

    case FunctionActionTypes.UpsertFunctions: {
      return adapter.upsertMany(action.payload.functions, state);
    }

    case FunctionActionTypes.UpdateFunction: {
      return adapter.updateOne(action.payload.function, state);
    }

    case FunctionActionTypes.UpdateFunctions: {
      return adapter.updateMany(action.payload.functions, state);
    }

    case FunctionActionTypes.DeleteFunction: {
      return adapter.removeOne(action.payload.id, state);
    }

    case FunctionActionTypes.DeleteFunctions: {
      return adapter.removeMany(action.payload.ids, state);
    }

    case FunctionActionTypes.LoadFunctions: {
      return adapter.setAll(action.payload.functions, {...state, loaded: true});
    }

    case FunctionActionTypes.ClearFunctions: {
      return adapter.removeAll(state);
    }

    default: {
      return state;
    }
  }
}

const functionFeatureSelector = createFeatureSelector<State>("function");

export const {selectIds, selectEntities, selectAll, selectTotal} =
  adapter.getSelectors(functionFeatureSelector);

export const selectLoaded = createSelector(functionFeatureSelector, state => state.loaded);

export const selectEmpty = createSelector(functionFeatureSelector, selectTotal, (state, total) => {
  return state.loaded && total == 0;
});
