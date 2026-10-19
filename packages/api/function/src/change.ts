import {diff} from "@spica-server/core-differ";
import {
  Triggers,
  Function,
  ChangeKind,
  TargetChange,
  FunctionChangePlan,
  EnvRelation,
  SecretRelation
} from "@spica-server/interface-function";
import {hasSecretPlaceholder} from "./secret-placeholder.js";

type FunctionDocument = Function<EnvRelation.NotResolved, SecretRelation.NotResolved>;

export function createPlan(
  previous: FunctionDocument | null,
  current: FunctionDocument | null
): FunctionChangePlan {
  if (previous && current) {
    const id = current._id.toString();
    if (previous.name != current.name) {
      return {
        routing: [
          ...createTargetChanges(previous, ChangeKind.Removed),
          ...createTargetChanges(current, ChangeKind.Added)
        ],
        outdate: [id],
        reconcile: [id],
        rename: [{from: previous.name, to: current.name}]
      };
    }
    return {
      routing: changesFromTriggers(previous, current),
      outdate: needsContextRefresh(previous, current) ? [id] : [],
      reconcile: [id]
    };
  }

  if (current) {
    return {
      routing: createTargetChanges(current, ChangeKind.Added),
      outdate: [],
      reconcile: [current._id.toString()]
    };
  }

  if (previous) {
    const id = previous._id.toString();
    return {
      routing: createTargetChanges(previous, ChangeKind.Removed),
      outdate: [id],
      reconcile: [id]
    };
  }

  return {routing: [], outdate: [], reconcile: []};
}

export function refreshPlan(id: string, dependents: string[] = []): FunctionChangePlan {
  const ids = [id, ...dependents];
  return {routing: [], outdate: ids, reconcile: ids};
}

export function secretRefreshPlan(fn: FunctionDocument, secretKeys: string[]): FunctionChangePlan {
  const referencingTriggers: Triggers = {};
  for (const [handler, trigger] of Object.entries(fn.triggers || {})) {
    if (trigger.active && hasSecretPlaceholder(trigger.options, secretKeys)) {
      referencingTriggers[handler] = trigger;
    }
  }

  return {
    ...refreshPlan(fn._id.toString()),
    routing: createTargetChanges({...fn, triggers: referencingTriggers}, ChangeKind.Updated)
  };
}

export function mergePlans(plans: FunctionChangePlan[]): FunctionChangePlan {
  return {
    routing: plans.flatMap(plan => plan.routing),
    outdate: [...new Set(plans.flatMap(plan => plan.outdate))],
    reconcile: [...new Set(plans.flatMap(plan => plan.reconcile))],
    rename: plans.flatMap(plan => plan.rename ?? [])
  };
}

function changesFromTriggers(
  previous: FunctionDocument,
  current: FunctionDocument
): TargetChange[] {
  const insertedTriggers: Triggers = {};
  const updatedTriggers: Triggers = {};
  const removedTriggers: Triggers = {};

  const previousTriggers = previous.triggers || {};
  const currentTriggers = current.triggers || {};

  for (const [handler, trigger] of Object.entries(currentTriggers)) {
    if (!Object.keys(previousTriggers).includes(handler) && trigger.active) {
      insertedTriggers[handler] = trigger;
    } else if (Object.keys(previousTriggers).includes(handler)) {
      //soft delete
      if (!trigger.active) {
        removedTriggers[handler] = trigger;
      } else if (diff(previousTriggers[handler], trigger).length) {
        updatedTriggers[handler] = trigger;
      }
    }
  }

  for (const [handler, trigger] of Object.entries(previousTriggers)) {
    if (!Object.keys(currentTriggers).includes(handler)) {
      removedTriggers[handler] = trigger;
    }
  }

  return [
    ...createTargetChanges({...current, triggers: insertedTriggers}, ChangeKind.Added),
    ...createTargetChanges({...current, triggers: updatedTriggers}, ChangeKind.Updated),
    ...createTargetChanges({...current, triggers: removedTriggers}, ChangeKind.Removed)
  ];
}

function needsContextRefresh(previous: FunctionDocument, current: FunctionDocument): boolean {
  return (
    diff(previous.env_vars, current.env_vars).length > 0 ||
    diff(previous.secrets, current.secrets).length > 0 ||
    previous.timeout != current.timeout
  );
}

function createTargetChanges(fn: FunctionDocument, changeKind: ChangeKind): TargetChange[] {
  const changes: TargetChange[] = [];
  for (const [handler, trigger] of Object.entries(fn.triggers || {})) {
    changes.push({
      kind: trigger.active ? changeKind : ChangeKind.Removed,
      options: trigger.options,
      type: trigger.type,
      target: {
        id: fn._id.toString(),
        handler,
        name: fn.name
      }
    });
  }
  return changes;
}
