/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type { ModuleRenderer, BaseModuleContext } from "../moduleRenderers";
import { Icon } from "oziko-ui-kit";
import type { ApiKey } from "../../../store/api/apiKeyApi";
import {
  buildResourceAccordionItems,
  renderFlatActions,
  renderResourceAccordion,
  splitActions,
  type OnResourceBatchChange,
  type OnResourceChange
} from "../moduleRendererHelpers";

export interface ApiKeyModuleProps extends BaseModuleContext {
  apiKeys?: ApiKey[];
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
}

export class ApiKeyModuleRenderer implements ModuleRenderer<ApiKeyModuleProps> {
  render(props: ApiKeyModuleProps): React.ReactNode {
    const {
      moduleStatement,
      statement,
      apiKeys,
      formatActionName,
      onResourceChange,
      onResourceBatchChange,
      onActionToggle
    } = props;

    const { actionsWithoutResource, actionsWithResource } = splitActions(moduleStatement.actions);

    return (
      <div data-module="passport:apikey">
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
              items: apiKeys,
              getId: apiKey => apiKey._id ?? "",
              getKey: apiKey => apiKey._id ?? apiKey.name,
              getLabel: apiKey => apiKey.name,
              getIcon: () => <Icon name="key" size="md" />
            }
          })
        )}
      </div>
    );
  }
}
