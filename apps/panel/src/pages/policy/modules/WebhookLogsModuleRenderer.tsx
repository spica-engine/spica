/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type { BaseModuleContext, ModuleRenderer } from "../moduleRenderers";
import { renderFlatActions } from "../moduleRendererHelpers";

export class WebhookLogsModuleRenderer implements ModuleRenderer<BaseModuleContext> {
  render(props: BaseModuleContext): React.ReactNode {
    const { moduleStatement, statement, formatActionName, onActionToggle } = props;

    return renderFlatActions({
      actions: moduleStatement.actions,
      module: moduleStatement.module,
      statement,
      formatActionName,
      onActionToggle,
      containerGap: 0,
      itemGap: 0
    });
  }
}
