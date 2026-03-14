/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useCallback, useMemo, useState } from "react";
import {Accordion, Checkbox, FlexElement} from "oziko-ui-kit";
import type {ModuleStatement} from "./hook/useStatement";
import type {DisplayedStatement} from "./policyStatements";
import {isActionActive} from "./policyStatements";
import styles from "./Policy.module.scss";
import { renderFlatActions } from "./moduleRendererHelpers";


export interface BaseModuleContext {
  moduleStatement: ModuleStatement;
  statement: DisplayedStatement | undefined;
  onActionToggle: (actionName: string, acceptsResource: boolean) => void;
  renderActionContent: (actionName: string, acceptsResource: boolean) => React.ReactNode;
  formatActionName: (actionName: string, module: string) => string;
}

export type ModuleRendererExtras = Record<string, unknown>;
export type ModuleDataProviderProps = {
  onData: (data: unknown) => void;
};
export type ModuleDataProvider = React.FC<ModuleDataProviderProps>;

export interface ModuleRenderer<TProps = BaseModuleContext> {
  render: (props: TProps) => React.ReactNode;
}

export type ModuleRendererPropsFactory<TProps = BaseModuleContext> = (
  baseContext: BaseModuleContext,
  extras: ModuleRendererExtras
) => TProps;

export class FlatModuleRenderer implements ModuleRenderer<BaseModuleContext> {
  render(context: BaseModuleContext): React.ReactNode {
    const { moduleStatement, statement, onActionToggle, formatActionName } = context;

    return renderFlatActions({
      actions: moduleStatement.actions,
      module: moduleStatement.module,
      statement,
      formatActionName,
      onActionToggle,
      containerGap: 10
    });
  }
}

export class AccordionModuleRenderer implements ModuleRenderer<BaseModuleContext> {
  render(context: BaseModuleContext): React.ReactNode {
    const {moduleStatement, statement, onActionToggle, renderActionContent, formatActionName} =
      context;

    const actionAccordionItems = moduleStatement.actions.map(moduleAction => {
      const active = statement ? isActionActive(statement, moduleAction.action) : false;
      const acceptsResource = moduleAction.resource !== undefined;

      return {
        title: (
          <div className={styles.actionTitleContainer}>
            <span>{formatActionName(moduleAction.action, moduleStatement.module)}</span>
            <Checkbox
              checked={active}
              onChange={e => {
                e.stopPropagation();
                onActionToggle(moduleAction.action, acceptsResource);
              }}
              onClick={e => e.stopPropagation()}
              checkBoxClassName={styles.actionCheckbox}
            />
          </div>
        ),
        content: renderActionContent(moduleAction.action, acceptsResource)
      };
    });

    return (
      <Accordion
        defaultActiveIndex={-1}
        items={actionAccordionItems}
        gap={0}
        headerClassName={`${styles.actionTitleContainer} ${styles.actionAccordion} ${styles.accordion}`}
      />
    );
  }
}

export class DefaultModuleRenderer implements ModuleRenderer<BaseModuleContext> {
  private readonly flatRenderer = new FlatModuleRenderer();
  private readonly accordionRenderer = new AccordionModuleRenderer();

  render(context: BaseModuleContext): React.ReactNode {
    const {moduleStatement} = context;

    if (moduleStatement.actions.every(action => action.resource === undefined)) {
      return this.flatRenderer.render(context);
    }
    
    return this.accordionRenderer.render(context);
  }
}

export class ModuleRendererRegistry {
  private readonly renderers = new Map<
    string,
    { renderer: ModuleRenderer<any>; buildProps?: ModuleRendererPropsFactory<any> }
  >();
  private readonly defaultRenderer = new DefaultModuleRenderer();

  register(
    moduleName: string,
    renderer: ModuleRenderer<any>,
    buildProps?: ModuleRendererPropsFactory<any>
  ): void {
    this.renderers.set(moduleName, { renderer, buildProps });
  }

  getRendererConfig(moduleName: string): {
    renderer: ModuleRenderer<any>;
    buildProps?: ModuleRendererPropsFactory<any>;
  } {
    return this.renderers.get(moduleName) || { renderer: this.defaultRenderer };
  }

  hasCustomRenderer(moduleName: string): boolean {
    return this.renderers.has(moduleName);
  }

  unregister(moduleName: string): void {
    this.renderers.delete(moduleName);
  }

  clear(): void {
    this.renderers.clear();
  }
}

export const moduleRendererRegistry = new ModuleRendererRegistry();

export class ModuleDataRegistry {
  private readonly providers = new Map<string, ModuleDataProvider>();

  register(moduleName: string, provider: ModuleDataProvider): void {
    this.providers.set(moduleName, provider);
  }

  getProviders(): Array<[string, ModuleDataProvider]> {
    return Array.from(this.providers.entries());
  }
}

export const moduleDataRegistry = new ModuleDataRegistry();

export function useModuleDataRegistry(): {
  moduleData: Record<string, unknown>;
  moduleDataElements: React.ReactNode;
} {
  const [moduleData, setModuleData] = useState<Record<string, unknown>>({});
  const providers = useMemo(() => moduleDataRegistry.getProviders(), []);

  const handleData = useCallback((moduleName: string, data: unknown) => {
    setModuleData(prev => {
      if (prev[moduleName] === data) return prev;
      return {...prev, [moduleName]: data};
    });
  }, []);

  const moduleDataElements = useMemo(() => {
    return providers.map(([moduleName, Provider]) => (
      <Provider key={moduleName} onData={data => handleData(moduleName, data)} />
    ));
  }, [handleData, providers]);

  return {moduleData, moduleDataElements};
}