import {Update} from "@ngrx/entity";
import {Action} from "@ngrx/store";

import {Webhook} from "../interface";

export enum WebhookActionTypes {
  LoadWebhooks = "[WebhookMeta] Load Webhooks",
  AddWebhook = "[WebhookMeta] Add WebhookMeta",
  UpsertWebhook = "[WebhookMeta] Upsert WebhookMeta",
  AddWebhooks = "[WebhookMeta] Add Webhooks",
  UpsertWebhooks = "[WebhookMeta] Upsert Webhooks",
  UpdateWebhook = "[WebhookMeta] Update WebhookMeta",
  UpdateWebhooks = "[WebhookMeta] Update Webhooks",
  DeleteWebhook = "[WebhookMeta] Delete WebhookMeta",
  DeleteWebhooks = "[WebhookMeta] Delete Webhooks",
  ClearWebhooks = "[WebhookMeta] Clear Webhooks"
}

export class LoadWebhooks implements Action {
  readonly type = WebhookActionTypes.LoadWebhooks;

  constructor(public payload: {webhooks: Webhook[]}) {}
}

export class AddWebhook implements Action {
  readonly type = WebhookActionTypes.AddWebhook;

  constructor(public payload: {webhook: Webhook}) {}
}

export class UpsertWebhook implements Action {
  readonly type = WebhookActionTypes.UpsertWebhook;

  constructor(public payload: {webhook: Webhook}) {}
}

export class AddWebhooks implements Action {
  readonly type = WebhookActionTypes.AddWebhooks;

  constructor(public payload: {webhooks: Webhook[]}) {}
}

export class UpsertWebhooks implements Action {
  readonly type = WebhookActionTypes.UpsertWebhooks;

  constructor(public payload: {webhooks: Webhook[]}) {}
}

export class UpdateWebhook implements Action {
  readonly type = WebhookActionTypes.UpdateWebhook;

  constructor(public payload: {webhook: Update<Webhook>}) {}
}

export class UpdateWebhooks implements Action {
  readonly type = WebhookActionTypes.UpdateWebhooks;

  constructor(public payload: {webhooks: Update<Webhook>[]}) {}
}

export class DeleteWebhook implements Action {
  readonly type = WebhookActionTypes.DeleteWebhook;
  constructor(public payload: {id: string}) {}
}

export class DeleteWebhooks implements Action {
  readonly type = WebhookActionTypes.DeleteWebhooks;

  constructor(public payload: {ids: string[]}) {}
}

export class ClearWebhooks implements Action {
  readonly type = WebhookActionTypes.ClearWebhooks;
}

export type WebhookActions =
  | LoadWebhooks
  | AddWebhook
  | UpsertWebhook
  | AddWebhooks
  | UpsertWebhooks
  | UpdateWebhook
  | UpdateWebhooks
  | DeleteWebhook
  | DeleteWebhooks
  | ClearWebhooks;
