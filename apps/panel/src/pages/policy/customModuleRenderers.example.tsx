/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import {FlexElement, Button, Icon, Checkbox} from "oziko-ui-kit";
import type {ModuleRenderer, ModuleRendererContext} from "./moduleRenderers";
import {isActionActive} from "./policyStatements";
import styles from "./Policy.module.scss";

export class BucketModuleRenderer implements ModuleRenderer {
  render(context: ModuleRendererContext): React.ReactNode {
    const {catalogModule, statement, onActionToggle, formatActionName} = context;

    return (
      <FlexElement dimensionX="fill" direction="vertical" gap={15}>
        <div style={{display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px"}}>
          {catalogModule.actions.map(action => {
            const active = statement ? isActionActive(statement, action.name) : false;

            return (
              <div
                key={action.name}
                style={{
                  padding: "12px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  backgroundColor: active ? "var(--color-primary-light)" : "var(--color-background)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <span>{formatActionName(action.name, catalogModule.module)}</span>
                <Checkbox
                  checked={active}
                  onChange={() => onActionToggle(action.name, action.acceptsResource)}
                  checkBoxClassName={styles.actionCheckbox}
                />
              </div>
            );
          })}
        </div>
      </FlexElement>
    );
  }
}

export class FunctionModuleRenderer implements ModuleRenderer {
  render(context: ModuleRendererContext): React.ReactNode {
    const {catalogModule, statement, onActionToggle, formatActionName} = context;

    return (
      <FlexElement dimensionX="fill" direction="vertical" gap={10} className={styles.flatActionsContainer}>
        {catalogModule.actions.map(action => {
          const active = statement ? isActionActive(statement, action.name) : false;

          return (
            <FlexElement
              key={action.name}
              dimensionX="fill"
              direction="horizontal"
              gap={10}
              className={styles.flatActionItem}
            >
              <span style={{flex: 1}}>{formatActionName(action.name, catalogModule.module)}</span>
              
              <Button
                variant="text"
                onClick={() => console.log("Test function action:", action.name)}
              >
                <Icon name="layers" />
              </Button>

              <Checkbox
                checked={active}
                onChange={() => onActionToggle(action.name, action.acceptsResource)}
                checkBoxClassName={styles.actionCheckbox}
              />
            </FlexElement>
          );
        })}
      </FlexElement>
    );
  }
}

export class GroupedModuleRenderer implements ModuleRenderer {
  render(context: ModuleRendererContext): React.ReactNode {
    const {catalogModule, statement, onActionToggle, formatActionName} = context;

    const crudActions = catalogModule.actions.filter(a =>
      ["index", "show", "create", "update", "delete"].some(op => a.name.includes(op))
    );
    const otherActions = catalogModule.actions.filter(
      a => !crudActions.includes(a)
    );

    const renderGroup = (title: string, actions: typeof catalogModule.actions) => {
      if (actions.length === 0) return null;

      return (
        <div style={{marginBottom: "15px"}}>
          <h4 style={{marginBottom: "8px", color: "var(--color-font-secondary)"}}>{title}</h4>
          <FlexElement dimensionX="fill" direction="vertical" gap={8}>
            {actions.map(action => {
              const active = statement ? isActionActive(statement, action.name) : false;

              return (
                <FlexElement
                  key={action.name}
                  dimensionX="fill"
                  direction="horizontal"
                  className={styles.flatActionItem}
                >
                  <span>{formatActionName(action.name, catalogModule.module)}</span>
                  <Checkbox
                    checked={active}
                    onChange={() => onActionToggle(action.name, action.acceptsResource)}
                    checkBoxClassName={styles.actionCheckbox}
                  />
                </FlexElement>
              );
            })}
          </FlexElement>
        </div>
      );
    };

    return (
      <FlexElement dimensionX="fill" direction="vertical" className={styles.flatActionsContainer}>
        {renderGroup("CRUD Operations", crudActions)}
        {renderGroup("Other Actions", otherActions)}
      </FlexElement>
    );
  }
}
