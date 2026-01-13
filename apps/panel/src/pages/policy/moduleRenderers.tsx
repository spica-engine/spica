/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import {Accordion, Checkbox, FlexElement} from "oziko-ui-kit";
import type {CatalogModule} from "./policyCatalog";
import type {DisplayedStatement} from "./policyStatements";
import {isActionActive} from "./policyStatements";
import styles from "./Policy.module.scss";

export interface ModuleRendererContext {
  catalogModule: CatalogModule;
  statement: DisplayedStatement | undefined;
  onActionToggle: (actionName: string, acceptsResource: boolean) => void;
  renderActionContent: (actionName: string, acceptsResource: boolean) => React.ReactNode;
  formatActionName: (actionName: string, module: string) => string;
}

export interface ModuleRenderer {
  render: (context: ModuleRendererContext) => React.ReactNode;
}

export class FlatModuleRenderer implements ModuleRenderer {
  render(context: ModuleRendererContext): React.ReactNode {
    const {catalogModule, statement, onActionToggle, formatActionName} = context;

    return (
      <FlexElement
        dimensionX="fill"
        direction="vertical"
        gap={10}
        className={styles.flatActionsContainer}
      >
        {catalogModule.actions.map(catalogAction => {
          const active = statement ? isActionActive(statement, catalogAction.name) : false;

          return (
            <FlexElement
              key={catalogAction.name}
              dimensionX="fill"
              direction="horizontal"
              className={styles.flatActionItem}
            >
              <span>{formatActionName(catalogAction.name, catalogModule.module)}</span>
              <Checkbox
                checked={active}
                onChange={() => {
                  onActionToggle(catalogAction.name, catalogAction.acceptsResource);
                }}
                checkBoxClassName={styles.actionCheckbox}
              />
            </FlexElement>
          );
        })}
      </FlexElement>
    );
  }
}

export class AccordionModuleRenderer implements ModuleRenderer {
  render(context: ModuleRendererContext): React.ReactNode {
    const {catalogModule, statement, onActionToggle, renderActionContent, formatActionName} =
      context;

    const actionAccordionItems = catalogModule.actions.map(catalogAction => {
      const active = statement ? isActionActive(statement, catalogAction.name) : false;

      return {
        title: (
          <div className={styles.actionTitleContainer}>
            <span>{formatActionName(catalogAction.name, catalogModule.module)}</span>
            <Checkbox
              checked={active}
              onChange={e => {
                e.stopPropagation();
                onActionToggle(catalogAction.name, catalogAction.acceptsResource);
              }}
              onClick={e => e.stopPropagation()}
              checkBoxClassName={styles.actionCheckbox}
            />
          </div>
        ),
        content: renderActionContent(catalogAction.name, catalogAction.acceptsResource)
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

export class DefaultModuleRenderer implements ModuleRenderer {
  private readonly flatRenderer = new FlatModuleRenderer();
  private readonly accordionRenderer = new AccordionModuleRenderer();

  render(context: ModuleRendererContext): React.ReactNode {
    const {catalogModule} = context;

    if (catalogModule.actions.every(action => !action.acceptsResource)) {
      return this.flatRenderer.render(context);
    }
    
    return this.accordionRenderer.render(context);
  }
}

export class ModuleRendererRegistry {
  private readonly renderers = new Map<string, ModuleRenderer>();
  private readonly defaultRenderer = new DefaultModuleRenderer();

  register(moduleName: string, renderer: ModuleRenderer): void {
    this.renderers.set(moduleName, renderer);
  }

  getRenderer(module: CatalogModule): ModuleRenderer {
    return this.renderers.get(module.module) || this.defaultRenderer;
  }

  unregister(moduleName: string): void {
    this.renderers.delete(moduleName);
  }

  has(moduleName: string): boolean {
    return this.renderers.has(moduleName);
  }

  clear(): void {
    this.renderers.clear();
  }
}

export const moduleRendererRegistry = new ModuleRendererRegistry();