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

export type PreferenceResourceItem = {
  title: string;
  value: string;
};

export interface PreferenceModuleProps extends BaseModuleContext {
  preferences?: PreferenceResourceItem[];
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
}

export class PreferenceModuleRenderer implements ModuleRenderer<PreferenceModuleProps> {
  render(props: PreferenceModuleProps): React.ReactNode {
    const {
      moduleStatement,
      statement,
      preferences,
      formatActionName,
      onResourceChange,
      onResourceBatchChange,
      onActionToggle
    } = props;

    const { actionsWithoutResource, actionsWithResource } = splitActions(moduleStatement.actions, {
      dedupeByName: true
    });

    return (
      <div data-module="preference">
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
              items: preferences,
              getId: preference => preference.value,
              getKey: preference => preference.value,
              getLabel: preference => preference.title
            }
          })
        )}
      </div>
    );
  }
}
