/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type { ModuleRenderer, BaseModuleContext } from "../moduleRenderers";
import { Icon } from "oziko-ui-kit";
import type { Webhook } from "../../../store/api/webhookApi";
import {
  buildResourceAccordionItems,
  renderFlatActions,
  renderResourceAccordion,
  splitActions,
  type OnResourceBatchChange,
  type OnResourceChange
} from "../moduleRendererHelpers";

export interface WebhookModuleProps extends BaseModuleContext {
  webhooks?: Webhook[];
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
}

export class WebhookModuleRenderer implements ModuleRenderer<WebhookModuleProps> {
  render(props: WebhookModuleProps): React.ReactNode {
    const {
      moduleStatement,
      statement,
      webhooks,
      formatActionName,
      onResourceChange,
      onResourceBatchChange,
      onActionToggle
    } = props;

    const { actionsWithoutResource, actionsWithResource } = splitActions(moduleStatement.actions);

    return (
      <div data-module="webhook">
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
              items: webhooks,
              getId: webhook => webhook._id ?? "",
              getKey: webhook => webhook._id ?? webhook.url,
              getLabel: webhook => webhook.url,
              getIcon: () => <Icon name="link" size="md" />
            }
          })
        )}
      </div>
    );
  }
}
