/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {useRef} from "react";
import {Accordion, Button, Checkbox, FlexElement} from "oziko-ui-kit";
import styles from "./Policy.module.scss";
import type {DisplayedStatement} from "./policyStatements";
import type {PolicyCatalog} from "./policyCatalog";
import {
  toggleAction,
  isActionActive,
  getActionResource,
  updateActionResource,
  toggleAllModuleActions,
  areAllModuleActionsEnabled
} from "./policyStatements";
import {moduleRendererRegistry} from "./moduleRenderers";
import {resourceRendererRegistry} from "./resourceRenderers";

interface ResourceProps {
  value: DisplayedStatement[];
  onChange: (statements: DisplayedStatement[]) => void;
  catalog: PolicyCatalog;
}

const Resource: React.FC<ResourceProps> = ({value, onChange, catalog}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);


  const findOrCreateStatement = (module: string): DisplayedStatement => {
    const existing = value.find(s => s.module === module);
    if (existing) return existing;
    return {module, actions: []};
  };

  const updateStatement = (
    module: string,
    updater: (stmt: DisplayedStatement) => DisplayedStatement
  ) => {
    const existingIndex = value.findIndex(s => s.module === module);

    if (existingIndex === -1) {
      const newStatement = updater({module, actions: []});
      if (newStatement.actions.length > 0) {
        onChange([...value, newStatement]);
      }
    } else {
      const updated = updater(value[existingIndex]);

      if (updated.actions.length === 0) {
        onChange(value.filter((_, idx) => idx !== existingIndex));
      } else {
        onChange(value.map((s, idx) => (idx === existingIndex ? updated : s)));
      }
    }
  };

  const handleActionToggle = (module: string, actionName: string, acceptsResource: boolean) => {
    updateStatement(module, stmt => toggleAction(stmt, actionName, acceptsResource));
  };

  const handleModuleToggle = (module: string, enable: boolean) => {
    const catalogModule = catalog.modules.find(m => m.module === module);
    if (!catalogModule) return;

    updateStatement(module, stmt => toggleAllModuleActions(stmt, catalogModule.actions, enable));
  };

  const handleResourceChange = (
    module: string,
    actionName: string,
    resourceId: string,
    type: "include" | "exclude",
    checked: boolean
  ) => {
    updateStatement(module, stmt => {
      const resource = getActionResource(stmt, actionName) || {include: [], exclude: []};
      const list = resource[type];

      const updated = {
        ...resource,
        [type]: checked ? [...list, resourceId] : list.filter(id => id !== resourceId)
      };

      return updateActionResource(stmt, actionName, updated);
    });
  };

  const handleExport = () => {
    const json = JSON.stringify(value, null, 2);

    navigator.clipboard
      .writeText(json)
      .then(() => {
        alert("Policy statements exported to clipboard!");
      })
      .catch(() => {
        const blob = new Blob([json], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "policy-statements.json";
        link.click();
        URL.revokeObjectURL(url);
      });
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          onChange(imported);
          alert("Policy statements imported successfully!");
        } else {
          alert("Invalid import format. Expected an array of statements.");
        }
      } catch (error) {
        alert("Failed to parse imported file. Please ensure it's valid JSON.");
      }
    };
    reader.readAsText(file);

    event.target.value = "";
  };

  const renderResourceItems = (module: string, actionName: string) => {
    const statement = value.find(s => s.module === module);
    const resource = statement ? getActionResource(statement, actionName) : undefined;

    if (!resource) return null;

    // Get the catalog module to find resources for this action
    const catalogModule = catalog.modules.find(m => m.module === module);
    const catalogAction = catalogModule?.actions.find(a => a.name === actionName);
    const resources = catalogAction?.resources || [];

    // Try to get a custom resource renderer
    const renderer = resourceRendererRegistry.getRenderer(module, actionName);
    const customRendering = renderer.render({
      module,
      actionName,
      resources,
      statement,
      onResourceChange: (resourceId: string, type: "include" | "exclude", checked: boolean) => {
        handleResourceChange(module, actionName, resourceId, type, checked);
      }
    });

    // If custom renderer provides UI, use it
    if (customRendering) {
      return customRendering;
    }

    // Otherwise, fall back to default rendering
    const hasIncludes = resource.include.length > 0;
    const hasExcludes = resource.exclude.length > 0;

    return (
      <FlexElement dimensionX="fill" direction="vertical" gap={5} className={styles.resourceItems}>
        <div className={styles.resourceSection}>
          <strong>Include:</strong>
          <div className={styles.resourceHint}>
            {hasIncludes ? (
              <span className={styles.resourceList}>
                {resource.include.map(id => (
                  <span key={id} className={styles.resourceTag}>
                    {id}
                  </span>
                ))}
              </span>
            ) : (
              <span className={styles.emptyState}>
                No resources selected (at least one required)
              </span>
            )}
          </div>
        </div>
        {hasExcludes && (
          <div className={styles.resourceSection}>
            <strong>Exclude:</strong>
            <div className={styles.resourceHint}>
              <span className={styles.resourceList}>
                {resource.exclude.map(id => (
                  <span key={id} className={styles.resourceTag}>
                    {id}
                  </span>
                ))}
              </span>
            </div>
          </div>
        )}
        <div className={styles.resourceNote}>
          <span>
            💡 Resource selection can be managed through a separate dialog. For now, resources can
            be imported/exported via JSON.
          </span>
        </div>
      </FlexElement>
    );
  };

  const renderActionContent = (module: string, actionName: string, acceptsResource: boolean) => {
    if (!acceptsResource) return null;

    const statement = value.find(s => s.module === module);
    const active = statement ? isActionActive(statement, actionName) : false;

    if (!active) return null;

    return renderResourceItems(module, actionName);
  };

  const formatActionName = (actionName: string, module: string): string => {
    return actionName
      .replace(`${module}:`, "")
      .replace(/:/g, " ")
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const renderModuleContent = (catalogModule: PolicyCatalog['modules'][0]) => {
    const statement = value.find(s => s.module === catalogModule.module);
    const renderer = moduleRendererRegistry.getRenderer(catalogModule);

    return renderer.render({
      catalogModule,
      statement,
      onActionToggle: (actionName, acceptsResource) => {
        handleActionToggle(catalogModule.module, actionName, acceptsResource);
      },
      renderActionContent: (actionName, acceptsResource) => {
        return renderActionContent(catalogModule.module, actionName, acceptsResource);
      },
      formatActionName
    });
  };

  const moduleAccordionItems = catalog.modules.map(catalogModule => {
    const statement = value.find(s => s.module === catalogModule.module);
    const allEnabled = statement
      ? areAllModuleActionsEnabled(statement, catalogModule.actions)
      : false;

    return {
      title: (
        <div className={styles.moduleTitleContainer}>
          <span>{catalogModule.label}</span>
          <Checkbox
            checked={allEnabled}
            onChange={(e) => {
              e.stopPropagation();
              handleModuleToggle(catalogModule.module, !allEnabled);
            }}
            onClick={e => e.stopPropagation()}
            checkBoxClassName={styles.actionCheckbox}

          />
        </div>
      ),
      content: renderModuleContent(catalogModule)
    };
  });

  return (
    <FlexElement
      dimensionX="fill"
      direction="vertical"
      gap={0}
      className={styles.resourceContainer}
    >
      <FlexElement dimensionX="fill" className={styles.resourceHeader}>
        <span>Resources</span>
        <FlexElement dimensionX="hug" alignment="rightCenter" direction="horizontal">
          <Button variant="text" className={styles.importExportButton} onClick={handleImport}>
            Import
          </Button>
          <span>/</span>
          <Button variant="text" className={styles.importExportButton} onClick={handleExport}>
            Export
          </Button>
        </FlexElement>
      </FlexElement>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{display: "none"}}
        onChange={e => handleFileChange(e)}
      />

        <Accordion
          items={moduleAccordionItems}
          gap={0}
          headerClassName={`${styles.accordion} ${styles.statementAccordion}`}
          contentClassName={styles.accordionContent}
          className={styles.accordionContainer}
          itemClassName={styles.accordionItem}
          defaultActiveIndex={-1}
          openClassName={styles.openAccordion}

        />
    </FlexElement>
  );
};

export default Resource;
