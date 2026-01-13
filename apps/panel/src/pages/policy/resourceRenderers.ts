/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import type { ApiResource } from "./mapApiStatementsToCatalog";
import type { DisplayedStatement } from "./policyStatements";

export interface ResourceRendererContext {
  module: string;
  actionName: string;
  resources: ApiResource[];
  statement: DisplayedStatement | undefined;
  onResourceChange: (resourceId: string, type: "include" | "exclude", checked: boolean) => void;
}

export interface ResourceRenderer {
  canHandle: (module: string, actionName: string) => boolean;
  render: (context: ResourceRendererContext) => React.ReactNode;
}

export class DefaultResourceRenderer implements ResourceRenderer {
  canHandle(module: string, actionName: string): boolean {
    return true;
  }

  render(context: ResourceRendererContext): React.ReactNode {
    return null;
  }
}

export class ResourceRendererRegistry {
  private renderers: ResourceRenderer[] = [];
  private defaultRenderer = new DefaultResourceRenderer();

  register(renderer: ResourceRenderer): void {
    this.renderers.push(renderer);
  }

  getRenderer(module: string, actionName: string): ResourceRenderer {
    const renderer = this.renderers.find((r) => r.canHandle(module, actionName));
    return renderer || this.defaultRenderer;
  }
}

export const resourceRendererRegistry = new ResourceRendererRegistry();

export class BucketResourceRenderer implements ResourceRenderer {
  canHandle(module: string, actionName: string): boolean {
    return module === "bucket" && actionName.includes("bucket:");
  }

  render(context: ResourceRendererContext): React.ReactNode {
    return null;
  }
}

resourceRendererRegistry.register(new BucketResourceRenderer());