/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type {
  ModuleRenderer,
  BaseModuleContext
} from "../moduleRenderers";
import { Accordion, Checkbox, FlexElement, FluidContainer, Icon, Text } from "oziko-ui-kit";
import styles from "../Policy.module.scss";
import type { BucketType } from "../../../store/api/bucketApi";

export interface BucketModuleProps extends BaseModuleContext {
  buckets?: BucketType[];
  onResourceChange?: (actionName: string, bucketId: string, type: "include" | "exclude", checked: boolean) => void;
  onResourceBatchChange?: (
    actionName: string,
    changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>
  ) => void;
}



export class BucketModuleRenderer implements ModuleRenderer<BucketModuleProps> {
  render(props: BucketModuleProps): React.ReactNode {
    const {
      moduleStatement,
      statement,
      buckets,
      formatActionName,
      onResourceChange,
      onResourceBatchChange,
      onActionToggle
    } = props;

    const actionsWithoutResource = moduleStatement.actions.filter(a => a.resource === undefined);
    const actionsWithResource = moduleStatement.actions.filter(a => a.resource !== undefined);

    const flatActions = actionsWithoutResource.map(moduleAction => {
      const statementAction = statement?.actions?.find(a => a.name === moduleAction.action);
      const isActive = statementAction !== undefined;

      return (
        <FlexElement
          key={moduleAction.action}
          dimensionX="fill"
          alignment="leftCenter"
          className={styles.flatActionItem}
        >

          <span>{formatActionName(moduleAction.action, moduleStatement.module)}</span>
          <Checkbox
            checked={isActive}
            onChange={() => {
              onActionToggle(moduleAction.action, false);
            }}
            checkBoxClassName={styles.actionCheckbox}
          />

        
        </FlexElement>
      );
    });

    // Render accordion items for actions that accept resources
    const accordionItems = actionsWithResource.map(moduleAction => {
      const statementAction = statement?.actions?.find(a => a.name === moduleAction.action);
      const include = statementAction?.resource?.include ?? [];

      const isAll = include.includes("*");
      const isNone = include.length === 0;
      const isMixed = !isAll && !isNone;

      const isBucketChecked = (bucketId: string) => {
        if (isAll) return true;
        return include.includes(bucketId);
      };

      const handleSelectAllBuckets = (checked: boolean) => {
        if (!onResourceChange && !onResourceBatchChange) return;

        if (checked) {
          if (onResourceBatchChange) {
            onResourceBatchChange(moduleAction.action, [
              {resourceId: "*", type: "include", checked: true}
            ]);
            return;
          }
          onResourceChange?.(moduleAction.action, "*", "include", true);
          return;
        }

        const changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}> = [];
        if (include.includes("*")) {
          changes.push({resourceId: "*", type: "include", checked: false});
        }
        buckets?.forEach(bucket => {
          if (include.includes(bucket._id)) {
            changes.push({resourceId: bucket._id, type: "include", checked: false});
          }
        });

        if (changes.length === 0) return;
        if (onResourceBatchChange) {
          onResourceBatchChange(moduleAction.action, changes);
          return;
        }

        changes.forEach(change => {
          onResourceChange?.(moduleAction.action, change.resourceId, change.type, change.checked);
        });
      };

      const handleBucketToggle = (bucketId: string, checked: boolean) => {
        if (!onResourceChange && !onResourceBatchChange) return;

        const changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}> = [];
        if (isAll && checked) {
          changes.push({resourceId: "*", type: "include", checked: false});
        }
        changes.push({resourceId: bucketId, type: "include", checked});

        if (onResourceBatchChange) {
          onResourceBatchChange(moduleAction.action, changes);
          return;
        }

        changes.forEach(change => {
          onResourceChange?.(moduleAction.action, change.resourceId, change.type, change.checked);
        });
      };

      return {
        title: (
          <div className={styles.moduleTitleContainer}>
            <span>{formatActionName(moduleAction.action, moduleStatement.module)}</span>
            <Checkbox
              checked={isAll}
              onChange={e => {
                e.stopPropagation();
                handleSelectAllBuckets(!isAll);
              }}
              indeterminate={isMixed}
              aria-checked={isMixed ? "mixed" : isAll}
              onClick={e => e.stopPropagation()}
              checkBoxClassName={styles.actionCheckbox}
            />
          </div>
        ),
        content: (
          <FlexElement dimensionX="fill" direction="vertical" gap={0}>
            {buckets?.map(bucket => (
              <FluidContainer
                key={bucket._id}
                mode="fill"
                dimensionX="fill"
                prefix={{
                  children: <Icon name="bucket" size="md" />
                }}
                root={{
                  children: <Text dimensionX="fill" size="medium">{bucket.title}</Text>
                }}
                suffix={{
                  children: (
                    <Checkbox
                      checked={isBucketChecked(bucket._id)}
                      onChange={e => {
                        e.stopPropagation();
                        handleBucketToggle(bucket._id, !isBucketChecked(bucket._id));
                      }}
                      onClick={e => e.stopPropagation()}
                      checkBoxClassName={styles.moduleCheckbox}
                    />
                  )
                }}
                className={styles.actionContentItemContainer}
              />
            ))}
          </FlexElement>
        )
      };
    });

    return (
      <div data-module="bucket">
        {flatActions.length > 0 && (
          <FlexElement
            dimensionX="fill"
            direction="vertical"
            gap={10}
            className={styles.flatActionsContainer}
          >
            {flatActions}
          </FlexElement>
        )}
        
        {accordionItems.length > 0 && (
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
        )}
      </div>
    );
  }
}
