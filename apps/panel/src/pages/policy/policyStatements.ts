/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */


export interface PolicyStatement {
  action: string;
  module: string;
  resource?: {
    include: string[];
    exclude: string[];
  };
}

export interface DisplayedAction {
  name: string;
  resource?: {
    include: string[];
    exclude: string[];
  };
}

export interface DisplayedStatement {
  module: string;
  actions: DisplayedAction[];
}

export function groupStatements(flatStatements: PolicyStatement[]): DisplayedStatement[] {
  const grouped: DisplayedStatement[] = [];

  flatStatements.forEach((statement) => {
    const existingIndex = grouped.findIndex((ds) => ds.module === statement.module);

    if (existingIndex === -1) {
      grouped.push({
        module: statement.module,
        actions: [
          {
            name: statement.action,
            resource: statement.resource,
          },
        ],
      });
    } else {
      grouped[existingIndex].actions.push({
        name: statement.action,
        resource: statement.resource,
      });
    }
  });

  return grouped;
}

export function flattenStatements(groupedStatements: DisplayedStatement[]): PolicyStatement[] {
  const flat: PolicyStatement[] = [];

  groupedStatements.forEach((statement) => {
    statement.actions.forEach((action) => {
      flat.push({
        module: statement.module,
        action: action.name,
        resource: action.resource,
      });
    });
  });

  return flat;
}

export function toggleAction(
  displayedStatement: DisplayedStatement,
  actionName: string,
  acceptsResource: boolean
): DisplayedStatement {
  const actionIndex = displayedStatement.actions.findIndex((a) => a.name === actionName);

  if (actionIndex === -1) {
    const newAction: DisplayedAction = { name: actionName };
    if (acceptsResource) {
      newAction.resource = { include: [], exclude: [] };
    }
    return {
      ...displayedStatement,
      actions: [...displayedStatement.actions, newAction],
    };
  } else {
    return {
      ...displayedStatement,
      actions: displayedStatement.actions.filter((_, idx) => idx !== actionIndex),
    };
  }
}

export function isActionActive(displayedStatement: DisplayedStatement, actionName: string): boolean {
  return displayedStatement.actions.some((a) => a.name === actionName);
}

export function getActionResource(
  displayedStatement: DisplayedStatement,
  actionName: string
): { include: string[]; exclude: string[] } | undefined {
  const action = displayedStatement.actions.find((a) => a.name === actionName);
  return action?.resource;
}

export function updateActionResource(
  displayedStatement: DisplayedStatement,
  actionName: string,
  resource: { include: string[]; exclude: string[] }
): DisplayedStatement {
  return {
    ...displayedStatement,
    actions: displayedStatement.actions.map((action) =>
      action.name === actionName ? { ...action, resource } : action
    ),
  };
}

export function validateStatements(
  displayedStatements: DisplayedStatement[],
  modules: Array<{ module: string; actions: Array<{ action: string; resource?: { include: string[]; exclude: string[] } }> }>
): boolean {
  for (const statement of displayedStatements) {
    const moduleStatement = modules.find((m) => m.module === statement.module);
    if (!moduleStatement) continue;

    for (const action of statement.actions) {
      // Check if the action exists in module and has resource defined (means it accepts resource)
      const moduleAction = moduleStatement.actions.find((a) => a.action === action.name);
      const acceptsResource = moduleAction?.resource !== undefined;
      
      if (acceptsResource) {
        if (!action.resource || action.resource.include.length === 0) {
          return false;
        }
      }
    }
  }

  return true;
}

export function toggleAllModuleActions(
  displayedStatement: DisplayedStatement,
  moduleActions: Array<{ action: string; resource?: { include: string[]; exclude: string[] } }>,
  enable: boolean
): DisplayedStatement {
  if (enable) {
    const newActions = moduleActions.map((moduleAction) => {
      const existingAction = displayedStatement.actions.find((a) => a.name === moduleAction.action);
      if (existingAction) return existingAction;

      const newAction: DisplayedAction = { name: moduleAction.action };
      // If module action has resource, it accepts resource
      if (moduleAction.resource !== undefined) {
        newAction.resource = { include: [], exclude: [] };
      }
      return newAction;
    });

    return { ...displayedStatement, actions: newActions };
  } else {
    return { ...displayedStatement, actions: [] };
  }
}

export function areAllModuleActionsEnabled(
  displayedStatement: DisplayedStatement,
  moduleActions: Array<{ action: string }>
): boolean {
  if (moduleActions.length === 0) return false;
  return moduleActions.every((moduleAction) =>
    displayedStatement.actions.some((a) => a.name === moduleAction.action)
  );
}
