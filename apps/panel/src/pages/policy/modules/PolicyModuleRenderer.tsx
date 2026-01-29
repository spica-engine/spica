/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type { ModuleRenderer, BaseModuleContext } from "../moduleRenderers";
import { Icon } from "oziko-ui-kit";
import type { Policy } from "../../../store/api/policyApi";
import {
  buildResourceAccordionItems,
  renderFlatActions,
  renderResourceAccordion,
  splitActions,
  type OnResourceBatchChange,
  type OnResourceChange
} from "../moduleRendererHelpers";

export interface PolicyModuleProps extends BaseModuleContext {
  policies?: Policy[];
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
}

export class PolicyModuleRenderer implements ModuleRenderer<PolicyModuleProps> {
  render(props: PolicyModuleProps): React.ReactNode {
    const {
      moduleStatement,
      statement,
      policies,
      formatActionName,
      onResourceChange,
      onResourceBatchChange,
      onActionToggle
    } = props;

    const { actionsWithoutResource, actionsWithResource } = splitActions(moduleStatement.actions);

    return (
      <div data-module="policy">
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
              items: policies,
              getId: policy => policy._id,
              getKey: policy => policy._id,
              getLabel: policy => policy.name,
              getIcon: () => <Icon name="lock" size="md" />
            }
          })
        )}
      </div>
    );
  }
}
