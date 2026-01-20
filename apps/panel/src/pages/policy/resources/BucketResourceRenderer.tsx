/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type {
  ResourceRenderer,
  ResourceRendererContext
} from "../resourceRenderers";

export interface BucketResourceProps extends ResourceRendererContext {
  bucketMetadata?: any;
}

export class BucketResourceRenderer implements ResourceRenderer<BucketResourceProps> {
  render(props: BucketResourceProps): React.ReactNode | null {
    const { module, actionName, resources, statement } = props;
    return null;
  }
}
