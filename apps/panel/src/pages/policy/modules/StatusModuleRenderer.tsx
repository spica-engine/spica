/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type { ModuleRenderer, BaseModuleContext } from "../moduleRenderers";
import {
  buildResourceAccordionItems,
  renderFlatActions,
  renderResourceAccordion,
  splitActions,
  type OnResourceBatchChange,
  type OnResourceChange
} from "../moduleRendererHelpers";

export type StatusResourceItem = {
  title: string;
  value: string;
};

export interface StatusModuleProps extends BaseModuleContext {
  statusResources?: StatusResourceItem[];
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
}

export class StatusModuleRenderer implements ModuleRenderer<StatusModuleProps> {
  render(props: StatusModuleProps): React.ReactNode {
    const {
      moduleStatement,
      statement,
      statusResources,
      formatActionName,
      onResourceChange,
      onResourceBatchChange,
      onActionToggle
    } = props;

    const { actionsWithoutResource, actionsWithResource } = splitActions(moduleStatement.actions, {
      dedupeByName: true
    });

    return (
      <div data-module="status">
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
              items: statusResources,
              getId: resource => resource.value,
              getKey: resource => resource.value,
              getLabel: resource => resource.title
            }
          })
        )}
      </div>
    );
  }
}
