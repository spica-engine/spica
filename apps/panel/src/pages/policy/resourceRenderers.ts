/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import type { DisplayedStatement } from "./policyStatements";


export interface ResourceRendererContext {
  module: string;
  actionName: string;
  statement: DisplayedStatement | undefined;
  onResourceChange: (resourceId: string, type: "include" | "exclude", checked: boolean) => void;
}


export interface ResourceRenderer<TProps = ResourceRendererContext> {
  render: (props: TProps) => React.ReactNode | null;
}

export class DefaultResourceRenderer implements ResourceRenderer<ResourceRendererContext> {
  render(context: ResourceRendererContext): React.ReactNode | null {
    return null;
  }
}

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