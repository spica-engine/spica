import {Update} from "@ngrx/entity";
import {Action} from "@ngrx/store";

import {Function} from "../interface";

export enum FunctionActionTypes {
  LoadFunctions = "[FunctionMeta] Load Functions",
  AddFunction = "[FunctionMeta] Add FunctionMeta",
  UpsertFunction = "[FunctionMeta] Upsert FunctionMeta",
  AddFunctions = "[FunctionMeta] Add Functions",
  UpsertFunctions = "[FunctionMeta] Upsert Functions",
  UpdateFunction = "[FunctionMeta] Update FunctionMeta",
  UpdateFunctions = "[FunctionMeta] Update Functions",
  DeleteFunction = "[FunctionMeta] Delete FunctionMeta",
  DeleteFunctions = "[FunctionMeta] Delete Functions",
  ClearFunctions = "[FunctionMeta] Clear Functions"
}

export class LoadFunctions implements Action {
  readonly type = FunctionActionTypes.LoadFunctions;

  constructor(public payload: {functions: Function[]}) {}
}

export class AddFunction implements Action {
  readonly type = FunctionActionTypes.AddFunction;

  constructor(public payload: {function: Function}) {}
}

export class UpsertFunction implements Action {
  readonly type = FunctionActionTypes.UpsertFunction;

  constructor(public payload: {function: Function}) {}
}

export class AddFunctions implements Action {
  readonly type = FunctionActionTypes.AddFunctions;

  constructor(public payload: {functions: Function[]}) {}
}

export class UpsertFunctions implements Action {
  readonly type = FunctionActionTypes.UpsertFunctions;

  constructor(public payload: {functions: Function[]}) {}
}

export class UpdateFunction implements Action {
  readonly type = FunctionActionTypes.UpdateFunction;

  constructor(public payload: {function: Update<Function>}) {}
}

export class UpdateFunctions implements Action {
  readonly type = FunctionActionTypes.UpdateFunctions;

  constructor(public payload: {functions: Update<Function>[]}) {}
}

export class DeleteFunction implements Action {
  readonly type = FunctionActionTypes.DeleteFunction;

  constructor(public payload: {id: string}) {}
}

export class DeleteFunctions implements Action {
  readonly type = FunctionActionTypes.DeleteFunctions;

  constructor(public payload: {ids: string[]}) {}
}

export class ClearFunctions implements Action {
  readonly type = FunctionActionTypes.ClearFunctions;
}

export type FunctionActions =
  | LoadFunctions
  | AddFunction
  | UpsertFunction
  | AddFunctions
  | UpsertFunctions
  | UpdateFunction
  | UpdateFunctions
  | DeleteFunction
  | DeleteFunctions
  | ClearFunctions;
