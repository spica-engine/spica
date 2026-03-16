/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type { ModuleRenderer, BaseModuleContext } from "../moduleRenderers";
import { Icon } from "oziko-ui-kit";
import type { Storage } from "../../../store/api/storageApi";
import {
  buildResourceAccordionItems,
  renderFlatActions,
  renderResourceAccordion,
  splitActions,
  type OnResourceBatchChange,
  type OnResourceChange
} from "../moduleRendererHelpers";

export interface StorageModuleProps extends BaseModuleContext {
  storages?: Storage[];
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
}

export class StorageModuleRenderer implements ModuleRenderer<StorageModuleProps> {
  render(props: StorageModuleProps): React.ReactNode {
    const {
      moduleStatement,
      statement,
      storages,
      formatActionName,
      onResourceChange,
      onResourceBatchChange,
      onActionToggle
    } = props;

    const { actionsWithoutResource, actionsWithResource } = splitActions(moduleStatement.actions);

    return (
      <div data-module="storage">
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
              items: storages,
              getId: storage => storage._id || "",
              getKey: storage => storage._id || storage.name,
              getLabel: storage => storage.name,
              getIcon: () => <Icon name="storage" size="md" />
            }
          })
        )}
      </div>
    );
  }
}
