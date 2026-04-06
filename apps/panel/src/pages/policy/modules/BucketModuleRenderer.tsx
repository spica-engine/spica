/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type { ModuleRenderer, BaseModuleContext } from "../moduleRenderers";
import { Icon } from "oziko-ui-kit";
import type { BucketType } from "../../../store/api/bucketApi";
import {
  buildResourceAccordionItems,
  renderFlatActions,
  renderResourceAccordion,
  splitActions,
  type OnResourceBatchChange,
  type OnResourceChange
} from "../moduleRendererHelpers";

export interface BucketModuleProps extends BaseModuleContext {
  buckets?: BucketType[];
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
}

export class BucketModuleRenderer implements ModuleRenderer<BucketModuleProps> {
  render(props: BucketModuleProps): React.ReactNode {
    const {
      moduleStatement,
      statement,
      buckets,
      formatActionName,
      onResourceChange,
      onResourceBatchChange,
      onActionToggle
    } = props;

    const { actionsWithoutResource, actionsWithResource } = splitActions(moduleStatement.actions);

    return (
      <div data-module="bucket">
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
              items: buckets,
              getId: bucket => bucket._id,
              getKey: bucket => bucket._id,
              getLabel: bucket => bucket.title,
              getIcon: () => <Icon name="bucket" size="md" />
            }
          })
        )}
      </div>
    );
  }
}
