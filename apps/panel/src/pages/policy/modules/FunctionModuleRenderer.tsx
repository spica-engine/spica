/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type { ModuleRenderer, BaseModuleContext } from "../moduleRenderers";
import { Icon } from "oziko-ui-kit";
import type { SpicaFunction } from "../../../store/api/functionApi";
import {
  buildResourceAccordionItems,
  renderFlatActions,
  renderResourceAccordion,
  splitActions,
  type OnResourceBatchChange,
  type OnResourceChange
} from "../moduleRendererHelpers";
import { idOf } from "../../../utils/recordKey";

export interface FunctionModuleProps extends BaseModuleContext {
  functions?: SpicaFunction[];
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
}

export class FunctionModuleRenderer implements ModuleRenderer<FunctionModuleProps> {
  render(props: FunctionModuleProps): React.ReactNode {
    const {
      moduleStatement,
      statement,
      functions,
      formatActionName,
      onResourceChange,
      onResourceBatchChange,
      onActionToggle
    } = props;

    const { actionsWithoutResource, actionsWithResource } = splitActions(moduleStatement.actions);

    return (
      <div data-module="function">
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
              items: functions,
              getId: func => idOf(func) || "",
              getKey: func => idOf(func) || func.name,
              getLabel: func => func.name,
              getIcon: () => <Icon name="layers" size="md" />
            }
          })
        )}
      </div>
    );
  }
}
