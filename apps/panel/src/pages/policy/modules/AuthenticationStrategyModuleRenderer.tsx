/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type { ModuleRenderer, BaseModuleContext } from "../moduleRenderers";
import { Icon } from "oziko-ui-kit";
import type { AuthenticationStrategy } from "../../../store/api/authenticationStrategyApi";
import {
  buildResourceAccordionItems,
  renderFlatActions,
  renderResourceAccordion,
  splitActions,
  type OnResourceBatchChange,
  type OnResourceChange
} from "../moduleRendererHelpers";

export interface AuthenticationStrategyModuleProps extends BaseModuleContext {
  strategies?: AuthenticationStrategy[];
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
}



export class AuthenticationStrategyModuleRenderer implements ModuleRenderer<AuthenticationStrategyModuleProps> {
  render(props: AuthenticationStrategyModuleProps): React.ReactNode {
    const {
      moduleStatement,
      statement,
      strategies,
      formatActionName,
      onResourceChange,
      onResourceBatchChange,
      onActionToggle
    } = props;

    const { actionsWithoutResource, actionsWithResource } = splitActions(moduleStatement.actions);

    return (
      <div data-module="passport:strategy">
        {renderFlatActions({
          actions: actionsWithoutResource,
          module: moduleStatement.module,
          statement,
          formatActionName,
          onActionToggle,
          containerGap: 10
        })}
        {renderResourceAccordion(
          buildResourceAccordionItems({
            actions: actionsWithResource,
            module: moduleStatement.module,
            statement,
            formatActionName,
            onResourceChange,
            onResourceBatchChange,
            itemConfig: {
              items: strategies,
              getId: strategy => strategy._id,
              getKey: strategy => strategy._id,
              getLabel: strategy => strategy.title,
              getIcon: () => <Icon name="shield" size="md" />
            }
          })
        )}
      </div>
    );
  }
}
