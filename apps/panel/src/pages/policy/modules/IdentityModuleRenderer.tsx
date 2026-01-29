/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type { ModuleRenderer, BaseModuleContext } from "../moduleRenderers";
import { Icon } from "oziko-ui-kit";
import type { Identity } from "../../../store/api/identityApi";
import {
  buildResourceAccordionItems,
  renderFlatActions,
  renderResourceAccordion,
  splitActions,
  type OnResourceBatchChange,
  type OnResourceChange
} from "../moduleRendererHelpers";

export interface IdentityModuleProps extends BaseModuleContext {
  identities?: Identity[];
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
}

export class IdentityModuleRenderer implements ModuleRenderer<IdentityModuleProps> {
  render(props: IdentityModuleProps): React.ReactNode {
    const {
      moduleStatement,
      statement,
      identities,
      formatActionName,
      onResourceChange,
      onResourceBatchChange,
      onActionToggle
    } = props;

    const { actionsWithoutResource, actionsWithResource } = splitActions(moduleStatement.actions);

    return (
      <div data-module="passport:identity">
        {renderFlatActions({
          actions: actionsWithoutResource,
          module: moduleStatement.module,
          statement,
          formatActionName,
          onActionToggle,
          containerGap: 0,
          itemGap: 0
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
              items: identities,
              getId: identity => identity._id || "",
              getKey: identity => identity._id || "",
              getLabel: identity => identity._id,
              getIcon: () => <Icon name="person" size="md" />
            }
          })
        )}
      </div>
    );
  }
}
