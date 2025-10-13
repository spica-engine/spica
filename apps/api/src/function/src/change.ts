import {diff} from "@spica-server/core/differ";
import {EnvVar} from "@spica-server/interface/env_var";
import {
  Triggers,
  Function,
  ChangeKind,
  TargetChange,
  EnvRelation
} from "@spica-server/interface/function";

export function changesFromTriggers(
  previousFn: Function<EnvRelation.Resolved | EnvRelation.NotResolved>,
  currentFn: Function<EnvRelation.Resolved>
) {
  const targetChanges: TargetChange[] = [];

  const insertedTriggers: Triggers = {};
  const updatedTriggers: Triggers = {};
  const removedTriggers: Triggers = {};

  for (const [handler, trigger] of Object.entries(currentFn.triggers)) {
    if (!Object.keys(previousFn.triggers).includes(handler) && trigger.active) {
      insertedTriggers[handler] = trigger;
    } else if (Object.keys(previousFn.triggers).includes(handler)) {
      //soft delete
      if (!trigger.active) {
        removedTriggers[handler] = trigger;
      } else if (diff(previousFn.triggers[handler], trigger).length) {
        updatedTriggers[handler] = trigger;
      }
    }
  }

  for (const [handler, trigger] of Object.entries(previousFn.triggers)) {
    if (!Object.keys(currentFn.triggers).includes(handler)) {
      removedTriggers[handler] = trigger;
    }
  }

  const insertChanges = createTargetChanges(
    {...currentFn, triggers: insertedTriggers},
    ChangeKind.Added
  );
  const updateChanges = createTargetChanges(
    {
      ...currentFn,
      triggers: updatedTriggers
    },
    ChangeKind.Updated
  );
  const removeChanges = createTargetChanges(
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

export function hasContextChange(
  previousFn: Function<EnvRelation.NotResolved>,
  currentFn: Function<EnvRelation.NotResolved>
) {
  return (
    diff(previousFn.env_vars, currentFn.env_vars).length > 0 ||
    previousFn.timeout != currentFn.timeout
  );
}

export function createTargetChanges<CK extends ChangeKind>(
  fn: Function<
    CK extends ChangeKind.Removed
      ? EnvRelation.Resolved | EnvRelation.NotResolved
      : EnvRelation.Resolved
  >,
  changeKind: CK
): TargetChange[] {
  const changes: TargetChange[] = [];
  for (const [handler, trigger] of Object.entries(fn.triggers)) {
    const change: TargetChange = {
      kind: trigger.active ? changeKind : ChangeKind.Removed,
      options: trigger.options,
      type: trigger.type,
      target: {
        id: fn._id.toString(),
        handler,
        name: fn.name
      }
    };

    if (changeKind != ChangeKind.Removed) {
      change.target.context = {
        env: normalizeEnvVars(fn.env_vars as EnvVar[]),
        timeout: fn.timeout
      };
    }

    changes.push(change);
  }
  return changes;
}

function normalizeEnvVars(envVars: EnvVar[]) {
  return (envVars || []).reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});
}
