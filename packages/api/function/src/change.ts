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

type FunctionDocument = Function<EnvRelation.NotResolved, SecretRelation.NotResolved>;

/**
 * Translate a function document transition into the runtime change plan it requires:
 * `previous == null` is a create, `current == null` is a delete, both present is an update.
 * The caller only supplies the before/after documents; deciding what the running system must
 * do about it lives here.
 */
export function createPlan(
  previous: FunctionDocument | null,
  current: FunctionDocument | null
): FunctionChangePlan {
  if (previous && current) {
    const id = current._id.toString();
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

/**
 * A function's baked runtime inputs — code, dependencies, or the resolved *values* of its
 * linked env vars/secrets — changed out of band. The document itself is unchanged, so there
 * is nothing to diff: just retire the workers and re-sync the function's scheduler config.
 */
export function refreshPlan(id: string): FunctionChangePlan {
  return {routing: [], outdate: [id], reconcile: [id]};
}

export function mergePlans(plans: FunctionChangePlan[]): FunctionChangePlan {
  return {
    routing: plans.flatMap(plan => plan.routing),
    outdate: [...new Set(plans.flatMap(plan => plan.outdate))],
    reconcile: [...new Set(plans.flatMap(plan => plan.reconcile))]
  };
}

function changesFromTriggers(previous: FunctionDocument, current: FunctionDocument): TargetChange[] {
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

// env/secret/timeout are baked into each worker at spawn and carried on every event, so a
// change to any of them must reach the runtime — unlike warmWorkers/concurrencyPerWorker,
// which are reconciled from the function's authoritative state without touching workers.
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
