import {Triggers, Function, Environment} from "./interface";

export function hasChange(pre: any, cur: any) {
  let results = [];
  if (typeof pre == "object" && typeof cur == "object") {
    for (const [key, value] of Object.entries(cur)) {
      results.push(hasChange(pre[key], value));
    }
  } else {
    results.push(pre != cur);
  }

  return results.some(hasChange => hasChange);
}

export function changesFromTriggers(previousFn: Function, currentFn: Function) {
  let targetChanges: TargetChange[] = [];

  let insertedTriggers: Triggers = {};
  let updatedTriggers: Triggers = {};
  let removedTriggers: Triggers = {};

  for (const [handler, trigger] of Object.entries(currentFn.triggers)) {
    if (!Object.keys(previousFn.triggers).includes(handler) && trigger.active) {
      insertedTriggers = {
        ...insertedTriggers,
        [handler]: trigger
      };
    } else if (Object.keys(previousFn.triggers).includes(handler)) {
      //soft delete
      if (!trigger.active) {
        removedTriggers = {
          ...removedTriggers,
          [handler]: trigger
        };
      } else if (hasChange(previousFn.triggers[handler], trigger)) {
        updatedTriggers = {
          [handler]: trigger
        };
      }
    }
  }

  for (const [handler, trigger] of Object.entries(previousFn.triggers)) {
    if (!Object.keys(currentFn.triggers).includes(handler)) {
      removedTriggers = {
        ...removedTriggers,
        [handler]: trigger
      };
    }
  }

  let insertChanges = this.createTargetChanges(
    {...currentFn, triggers: insertedTriggers},
    ChangeKind.Added
  );
  let updateChanges = this.createTargetChanges(
    {
      ...currentFn,
      triggers: updatedTriggers
    },
    ChangeKind.Updated
  );
  let removeChanges = this.createTargetChanges(
    {
      ...currentFn,
      triggers: removedTriggers
    },
    ChangeKind.Removed
  );

  targetChanges.push(...insertChanges);
  targetChanges.push(...updateChanges);
  targetChanges.push(...removeChanges);

  return targetChanges;
}

export function createTargetChanges(fn: Function, changeKind: ChangeKind): TargetChange[] {
  let changes: TargetChange[] = [];
  for (const [handler, trigger] of Object.entries(fn.triggers)) {
    changes.push({
      kind: changeKind,
      options: trigger.options,
      type: trigger.type,
      target: {
        id: fn._id.toString(),
        handler,
        context: {
          env: fn.env,
          timeout: fn.timeout
        }
      }
    });
  }
  return changes;
}

export enum ChangeKind {
  Added = 0,
  Removed = 1,
  Updated = 2
}

export interface Context {
  timeout: number;
  env: Environment;
}

export interface TargetChange {
  kind: ChangeKind;
  type?: string;
  options?: unknown;
  target: {
    id: string;
    handler?: string;
    context?: Context;
  };
}
