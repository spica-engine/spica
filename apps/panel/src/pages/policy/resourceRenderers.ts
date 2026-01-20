/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import type { ResourceItem } from "./policyCatalog";
import type { DisplayedStatement } from "./policyStatements";

// Context passed to resource renderers - module-level, not action-level
export interface ResourceRendererContext {
  module: string;
  actionName: string;
  resources: ResourceItem[];
  statement: DisplayedStatement | undefined;
  onResourceChange: (resourceId: string, type: "include" | "exclude", checked: boolean) => void;
}

// Generic resource renderer interface - returns null to use fallback UI
export interface ResourceRenderer<TProps = ResourceRendererContext> {
  render: (props: TProps) => React.ReactNode | null;
}

// Default renderer returns null so Resource.tsx uses fallback UI
export class DefaultResourceRenderer implements ResourceRenderer<ResourceRendererContext> {
  render(context: ResourceRendererContext): React.ReactNode | null {
    return null;
  }
}

// Registry for resource renderers - MODULE-LEVEL lookup only
export class ResourceRendererRegistry {
  private readonly renderers = new Map<string, ResourceRenderer<any>>();
  private readonly defaultRenderer = new DefaultResourceRenderer();

  register(module: string, renderer: ResourceRenderer<any>): void {
    this.renderers.set(module, renderer);
  }

  getRenderer(module: string): ResourceRenderer<any> {
    return this.renderers.get(module) || this.defaultRenderer;
  }

  hasCustomRenderer(module: string): boolean {
    return this.renderers.has(module);
  }

  unregister(module: string): void {
    this.renderers.delete(module);
  }

  clear(): void {
    this.renderers.clear();
  }
}

export const resourceRendererRegistry = new ResourceRendererRegistry();