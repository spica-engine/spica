/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type { ModuleRenderer, BaseModuleContext } from "../moduleRenderers";
import { Icon } from "oziko-ui-kit";
import type { Dashboard } from "../../../store/api/dashboardApi";
import {
  buildResourceAccordionItems,
  renderFlatActions,
  renderResourceAccordion,
  splitActions,
  type OnResourceBatchChange,
  type OnResourceChange
} from "../moduleRendererHelpers";

export interface DashboardModuleProps extends BaseModuleContext {
  dashboards?: Dashboard[];
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
}

export class DashboardModuleRenderer implements ModuleRenderer<DashboardModuleProps> {
  render(props: DashboardModuleProps): React.ReactNode {
    const {
      moduleStatement,
      statement,
      dashboards,
      formatActionName,
      onResourceChange,
      onResourceBatchChange,
      onActionToggle
    } = props;

    const { actionsWithoutResource, actionsWithResource } = splitActions(moduleStatement.actions);

    return (
      <div data-module="dashboard">
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
              items: dashboards,
              getId: dashboard => dashboard._id || "",
              getKey: dashboard => dashboard._id || dashboard.name,
              getLabel: dashboard => dashboard.name,
              getIcon: () => <Icon name="dashboard" size="md" />
            }
          })
        )}
      </div>
    );
  }
}
