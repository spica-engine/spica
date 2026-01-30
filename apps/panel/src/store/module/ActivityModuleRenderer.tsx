/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type { BaseModuleContext, ModuleRenderer } from "../../pages/policy/moduleRenderers";
import { Checkbox, FlexElement } from "oziko-ui-kit";
import styles from "../../pages/policy/Policy.module.css";

export class ActivityModuleRenderer implements ModuleRenderer<BaseModuleContext> {
  render(props: BaseModuleContext): React.ReactNode {
    const {
      moduleStatement,
      statement,
      formatActionName,
      onActionToggle
    } = props;

    const flatActions = moduleStatement.actions.map(moduleAction => {
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

    return (
      <FlexElement
        dimensionX="fill"
        direction="vertical"
        gap={10}
        className={styles.flatActionsContainer}
      >
        {flatActions}
      </FlexElement>
    );
  }
}
