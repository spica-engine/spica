import {createEntityAdapter, EntityAdapter, EntityState} from "@ngrx/entity";
import {createFeatureSelector, createSelector} from "@ngrx/store";

import {WebhookActions, WebhookActionTypes} from "../actions/webhook.actions";
import {Webhook} from "../interface";

export interface State extends EntityState<Webhook> {
  loaded: boolean;
}

export const adapter: EntityAdapter<Webhook> = createEntityAdapter<Webhook>({
  selectId: wb => wb._id as string
});

export const initialState: State = adapter.getInitialState({loaded: false});

export function reducer(state = initialState, action: WebhookActions): State {
  switch (action.type) {
    case WebhookActionTypes.AddWebhook: {
      return adapter.addOne(action.payload.webhook, state);
    }

    case WebhookActionTypes.UpsertWebhook: {
      return adapter.upsertOne(action.payload.webhook, state);
    }

    case WebhookActionTypes.AddWebhooks: {
      return adapter.addMany(action.payload.webhooks, state);
    }

    case WebhookActionTypes.UpsertWebhooks: {
      return adapter.upsertMany(action.payload.webhooks, state);
    }

    case WebhookActionTypes.UpdateWebhook: {
      return adapter.updateOne(action.payload.webhook, state);
    }

    case WebhookActionTypes.UpdateWebhooks: {
      return adapter.updateMany(action.payload.webhooks, state);
    }

    case WebhookActionTypes.DeleteWebhook: {
      return adapter.removeOne(action.payload.id, state);
    }

    case WebhookActionTypes.DeleteWebhooks: {
      return adapter.removeMany(action.payload.ids, state);
    }

    case WebhookActionTypes.LoadWebhooks: {
      return adapter.setAll(action.payload.webhooks, {...state, loaded: true});
    }

    case WebhookActionTypes.ClearWebhooks: {
      return adapter.removeAll(state);
    }

    default: {
      return state;
    }
  }
}

const webhookFeatureSelector = createFeatureSelector<State>("webhook");

export const {selectIds, selectEntities, selectAll, selectTotal} = adapter.getSelectors(
  webhookFeatureSelector
);

export const selectLoaded = createSelector(
  webhookFeatureSelector,
  state => state.loaded
);

export const selectEmpty = createSelector(
  webhookFeatureSelector,
  selectTotal,
  (state, total) => {
    return state.loaded && total == 0;
  }
);
