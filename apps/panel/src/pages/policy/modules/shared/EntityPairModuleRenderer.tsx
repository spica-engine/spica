/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 * 
 * Generic reusable component for rendering entity-pair selection modules
 * Follows DRY principle and composition patterns
 */

import React, { useState } from "react";
import { Accordion, Button, FlexElement, Icon, Select } from "oziko-ui-kit";
import type { ModuleRenderer, BaseModuleContext } from "../../moduleRenderers";
import styles from "../../Policy.module.scss";
import type { OnResourceChange, OnResourceBatchChange } from "../../moduleRendererHelpers";

export interface EntityPairConfig<TLeft, TRight> {
  leftEntities: TLeft[];
  rightEntities: TRight[];
  getLeftId: (entity: TLeft) => string;
  getRightId: (entity: TRight) => string;
  getLeftLabel: (entity: TLeft) => string;
  getRightLabel: (entity: TRight) => string;
  leftPlaceholder: string;
  rightPlaceholder: string;
  actionNamePrefix: string;
  dataModule: string;
}

export interface EntityPairModuleProps<TLeft, TRight> extends BaseModuleContext {
  config: EntityPairConfig<TLeft, TRight>;
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
}

export class EntityPairModuleRenderer<TLeft, TRight> implements ModuleRenderer<EntityPairModuleProps<TLeft, TRight>> {
  render(props: EntityPairModuleProps<TLeft, TRight>): React.ReactNode {
    const {
      moduleStatement,
      statement,
      config,
      formatActionName,
      onResourceChange,
      onResourceBatchChange
    } = props;


    const relevantActions = moduleStatement.actions.filter(
      action => action.action.startsWith(config.actionNamePrefix + ":")
    );

    if (relevantActions.length === 0) return null;

    const accordionItems = relevantActions.map(action => {
      const statementAction = statement?.actions?.find(
        item => item.name === action.action
      );

      const include = statementAction?.resource?.include ?? [];

      const selectedCombinations = include
        .filter(resource => resource.includes("/"))
        .map(resource => {
          const [leftId, rightId] = resource.split("/");
          return { leftId, rightId };
        });

      return {
        title: (
          <div className={styles.moduleTitleContainer}>
            <span>{formatActionName(action.action, moduleStatement.module)}</span>
          </div>
        ),
        content: (
          <EntityPairActionContent
            config={config}
            selectedCombinations={selectedCombinations}
            onResourceChange={(resourceId, checked) => {
              if (onResourceBatchChange) {
                onResourceBatchChange(action.action, [
                  { resourceId, type: "include", checked }
                ]);
              } else if (onResourceChange) {
                onResourceChange(action.action, resourceId, "include", checked);
              }
            }}
          />
        )
      };
    });

    return (
      <div data-module={config.dataModule}>
        <Accordion
          items={accordionItems}
          gap={0}
          headerClassName={`${styles.accordion} ${styles.statementAccordion}`}
          contentClassName={`${styles.accordionContent} ${styles.actionContentContainer}`}
          className={styles.accordionContainer}
          itemClassName={styles.accordionItem}
          defaultActiveIndex={-1}
          openClassName={styles.openAccordion}
        />
      </div>
    );
  }
}

interface EntityPairActionContentProps<TLeft, TRight> {
  config: EntityPairConfig<TLeft, TRight>;
  selectedCombinations: Array<{ leftId: string; rightId: string }>;
  onResourceChange: (resourceId: string, checked: boolean) => void;
}

const EntityPairActionContent = <TLeft, TRight>({
  config,
  selectedCombinations,
  onResourceChange
}: EntityPairActionContentProps<TLeft, TRight>) => {
  const [rows, setRows] = useState<Array<{ id: string; leftId: string; rightId: string }>>(() => {
    if (selectedCombinations.length > 0) {
      return selectedCombinations.map((combo, index) => ({
        id: `row-${index}`,
        leftId: combo.leftId,
        rightId: combo.rightId
      }));
    }
    return [{ id: 'row-0', leftId: '', rightId: '' }];
  });

  const leftOptions = config.leftEntities.map(entity => ({
    label: config.getLeftLabel(entity),
    value: config.getLeftId(entity)
  }));

  const rightOptions = config.rightEntities.map(entity => ({
    label: config.getRightLabel(entity),
    value: config.getRightId(entity)
  }));

  const handleAdd = () => {
    const newRow = {
      id: `row-${Date.now()}`,
      leftId: '',
      rightId: ''
    };
    setRows([...rows, newRow]);
  };

  const handleRemove = (rowId: string) => {
    const updatedRows = rows.filter(row => row.id !== rowId);
    setRows(updatedRows.length > 0 ? updatedRows : [{ id: 'row-0', leftId: '', rightId: '' }]);
  };

  const areAllRowsFilled = rows.every(row => row.leftId && row.rightId);

  const handleLeftChange = (rowId: string, leftId: string) => {
    setRows(rows.map(row => row.id === rowId ? { ...row, leftId } : row));
  };

  const handleRightChange = (rowId: string, rightId: string) => {
    setRows(rows.map(row => row.id === rowId ? { ...row, rightId } : row));
  };

  React.useEffect(() => {
    // Clear old selections
    selectedCombinations.forEach(combo => {
      const resourceId = `${combo.leftId}/${combo.rightId}`;
      onResourceChange(resourceId, false);
    });

    // Apply new selections
    rows.forEach(row => {
      if (row.leftId && row.rightId) {
        const resourceId = `${row.leftId}/${row.rightId}`;
        onResourceChange(resourceId, true);
      }
    });
  }, [rows]);

  return (
    <FlexElement dimensionX="fill" direction="vertical" gap={12} className={styles.apiKeyPolicyContentContainer}>
      {rows.map((row) => (
        <FlexElement key={row.id} dimensionX="fill" direction="horizontal" gap={8} alignment="center">
          <Select
            options={leftOptions}
            value={row.leftId}
            onChange={(value) => handleLeftChange(row.id, value as string)}
            placeholder={config.leftPlaceholder}
            className={styles.selectInput}
          />
          <Select
            options={rightOptions}
            value={row.rightId}
            onChange={(value) => handleRightChange(row.id, value as string)}
            placeholder={config.rightPlaceholder}
            className={styles.selectInput}
          />
          {rows.length > 1 && (
            <Button
              variant="icon"
              color="danger"
              onClick={() => handleRemove(row.id)}
              className={styles.removeButton}
            >
              <Icon name="delete" />
            </Button>
          )}
        </FlexElement>
      ))}
      
      <Button
        variant="dashed"
        color="primary"
        onClick={handleAdd}
        disabled={!areAllRowsFilled}
      >
        Add resource
        <Icon name="plus" />
      </Button>
    </FlexElement>
  );
};
