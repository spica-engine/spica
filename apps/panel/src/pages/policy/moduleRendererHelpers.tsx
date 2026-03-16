/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import { Accordion, Checkbox, FlexElement, FluidContainer, Text } from "oziko-ui-kit";
import styles from "./Policy.module.scss";
import type { DisplayedStatement } from "./policyStatements";
import type { ModuleStatement } from "./hook/useStatement";

export type ResourceChange = {
  resourceId: string;
  type: "include" | "exclude";
  checked: boolean;
};

export type OnResourceChange = (
  actionName: string,
  resourceId: string,
  type: "include" | "exclude",
  checked: boolean
) => void;

export type OnResourceBatchChange = (actionName: string, changes: ResourceChange[]) => void;

type ModuleAction = ModuleStatement["actions"][number];

type RenderFlatActionsArgs = {
  actions: ModuleAction[];
  module: string;
  statement: DisplayedStatement | undefined;
  formatActionName: (actionName: string, module: string) => string;
  onActionToggle: (actionName: string, acceptsResource: boolean) => void;
  containerGap?: number;
  itemGap?: number;
};

type ResourceItemConfig<TItem> = {
  items?: TItem[];
  getId: (item: TItem) => string;
  getLabel: (item: TItem) => string;
  getKey?: (item: TItem) => React.Key;
  getIcon?: (item: TItem) => React.ReactNode;
};

type BuildResourceAccordionItemsArgs<TItem> = {
  actions: ModuleAction[];
  module: string;
  statement: DisplayedStatement | undefined;
  formatActionName: (actionName: string, module: string) => string;
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
  itemConfig: ResourceItemConfig<TItem>;
};

export function dedupeActionsByName(actions: ModuleAction[]): ModuleAction[] {
  const map = new Map<string, ModuleAction>();
  actions.forEach(action => {
    const existing = map.get(action.action);
    if (!existing) {
      map.set(action.action, action);
      return;
    }

    if (!existing.resource && action.resource) {
      map.set(action.action, action);
    }
  });

  return Array.from(map.values());
}

export function splitActions(
  actions: ModuleAction[],
  options?: { dedupeByName?: boolean }
): { actionsWithoutResource: ModuleAction[]; actionsWithResource: ModuleAction[] } {
  const source = options?.dedupeByName ? dedupeActionsByName(actions) : actions;
  return {
    actionsWithoutResource: source.filter(action => action.resource === undefined),
    actionsWithResource: source.filter(action => action.resource !== undefined)
  };
}

export function renderFlatActions({
  actions,
  module,
  statement,
  formatActionName,
  onActionToggle,
  containerGap = 10,
  itemGap
}: RenderFlatActionsArgs): React.ReactNode {
  if (actions.length === 0) return null;

  const activeActions = new Set(statement?.actions?.map(action => action.name) ?? []);

  return (
    <FlexElement
      dimensionX="fill"
      direction="vertical"
      gap={containerGap}
      className={styles.flatActionsContainer}
    >
      {actions.map(moduleAction => {
        const acceptsResource = moduleAction.resource !== undefined;
        return (
          <FlexElement
            key={moduleAction.action}
            dimensionX="fill"
            alignment="leftCenter"
            className={styles.flatActionItem}
            gap={itemGap}
          >
            <span>{formatActionName(moduleAction.action, module)}</span>
            <Checkbox
              checked={activeActions.has(moduleAction.action)}
              onChange={() => {
                onActionToggle(moduleAction.action, acceptsResource);
              }}
              checkBoxClassName={styles.actionCheckbox}
            />
          </FlexElement>
        );
      })}
    </FlexElement>
  );
}

export function buildResourceAccordionItems<TItem>({
  actions,
  module,
  statement,
  formatActionName,
  onResourceChange,
  onResourceBatchChange,
  itemConfig
}: BuildResourceAccordionItemsArgs<TItem>): Array<{
  title: React.ReactNode;
  content: React.ReactNode;
}> {
  if (actions.length === 0) return [];

  return actions.map(action => {
    const statementAction = statement?.actions?.find(item => item.name === action.action);
    const include = statementAction?.resource?.include ?? [];
    const includeSet = new Set(include);

    const isAll = includeSet.has("*");
    const isNone = include.length === 0;
    const isMixed = !isAll && !isNone;

    const isItemChecked = (resourceId: string) => {
      if (isAll) return true;
      return includeSet.has(resourceId);
    };

    const applyChanges = (changes: ResourceChange[]) => {
      if (changes.length === 0) return;
      if (onResourceBatchChange) {
        onResourceBatchChange(action.action, changes);
        return;
      }
      changes.forEach(change => {
        onResourceChange?.(action.action, change.resourceId, change.type, change.checked);
      });
    };

    const handleSelectAll = (checked: boolean) => {
      if (!onResourceChange && !onResourceBatchChange) return;

      if (checked) {
        applyChanges([{ resourceId: "*", type: "include", checked: true }]);
        return;
      }

      const changes: ResourceChange[] = [];
      if (includeSet.has("*")) {
        changes.push({ resourceId: "*", type: "include", checked: false });
      }
      itemConfig.items?.forEach(item => {
        const resourceId = itemConfig.getId(item);
        if (includeSet.has(resourceId)) {
          changes.push({ resourceId, type: "include", checked: false });
        }
      });
      applyChanges(changes);
    };

    const handleItemToggle = (resourceId: string, checked: boolean) => {
      if (!onResourceChange && !onResourceBatchChange) return;

      const changes: ResourceChange[] = [];
      if (isAll && checked) {
        changes.push({ resourceId: "*", type: "include", checked: false });
      }
      changes.push({ resourceId, type: "include", checked });
      applyChanges(changes);
    };

    return {
      title: (
        <div className={styles.moduleTitleContainer}>
          <span>{formatActionName(action.action, module)}</span>
          <Checkbox
            checked={isAll}
            onChange={event => {
              event.stopPropagation();
              handleSelectAll(!isAll);
            }}
            indeterminate={isMixed}
            aria-checked={isMixed ? "mixed" : isAll}
            onClick={event => event.stopPropagation()}
            checkBoxClassName={styles.actionCheckbox}
          />
        </div>
      ),
      content: (
        <FlexElement dimensionX="fill" direction="vertical" gap={0}>
          {itemConfig.items?.map(item => {
            const resourceId = itemConfig.getId(item);
            const key = itemConfig.getKey?.(item) ?? resourceId;
            const icon = itemConfig.getIcon?.(item);
            return (
              <FluidContainer
                key={key}
                mode="fill"
                dimensionX="fill"
                prefix={icon ? { children: icon } : undefined}
                root={{
                  children: (
                    <Text dimensionX="fill" size="medium">
                      {itemConfig.getLabel(item)}
                    </Text>
                  )
                }}
                suffix={{
                  children: (
                    <Checkbox
                      checked={isItemChecked(resourceId)}
                      onChange={event => {
                        event.stopPropagation();
                        handleItemToggle(resourceId, !isItemChecked(resourceId));
                      }}
                      onClick={event => event.stopPropagation()}
                      checkBoxClassName={styles.moduleCheckbox}
                    />
                  )
                }}
                className={styles.actionContentItemContainer}
              />
            );
          })}
        </FlexElement>
      )
    };
  });
}

export function renderResourceAccordion(
  items: Array<{ title: React.ReactNode; content: React.ReactNode }>
): React.ReactNode {
  if (items.length === 0) return null;

  return (
    <Accordion
      items={items}
      gap={0}
      headerClassName={`${styles.accordion} ${styles.statementAccordion}`}
      contentClassName={`${styles.accordionContent} ${styles.actionContentContainer}`}
      className={styles.accordionContainer}
      itemClassName={styles.accordionItem}
      defaultActiveIndex={-1}
      openClassName={styles.openAccordion}
    />
  );
}
