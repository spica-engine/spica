/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {useCallback, useMemo, useRef} from "react";
import {Accordion, Button, Checkbox, FlexElement} from "oziko-ui-kit";
import styles from "./Policy.module.scss";
import type {DisplayedStatement} from "./policyStatements";
import type {ModuleStatement} from "./hook/useStatement";
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
  modules: ModuleStatement[];
  moduleData?: Record<string, unknown>;
}

const Resource: React.FC<ResourceProps> = ({value, onChange, modules, moduleData}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateStatement = useCallback((
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
  }, [onChange, value]);

  const handleActionToggle = useCallback((module: string, actionName: string, acceptsResource: boolean) => {
    updateStatement(module, stmt => toggleAction(stmt, actionName, acceptsResource));
  }, [updateStatement]);

  const handleModuleToggle = useCallback((module: string, enable: boolean) => {
    const moduleStatement = modules.find(m => m.module === module);
    if (!moduleStatement) return;

    updateStatement(module, stmt => toggleAllModuleActions(stmt, moduleStatement.actions, enable));
  }, [modules, updateStatement]);

  const applyResourceChanges = useCallback((
    module: string,
    actionName: string,
    changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>
  ) => {
    if (changes.length === 0) return;
    updateStatement(module, stmt => {
      let statement = stmt;
      const actionExists = stmt.actions.find(a => a.name === actionName);
      
      if (!actionExists) {
        statement = toggleAction(stmt, actionName, true);
      }

      const resource = getActionResource(statement, actionName) || {include: [], exclude: []};
      const includeSet = new Set(resource.include);
      const excludeSet = new Set(resource.exclude);

      changes.forEach(change => {
        const targetSet = change.type === "include" ? includeSet : excludeSet;
        if (change.checked) {
          targetSet.add(change.resourceId);
        } else {
          targetSet.delete(change.resourceId);
        }
      });

      return updateActionResource(statement, actionName, {
        include: Array.from(includeSet),
        exclude: Array.from(excludeSet)
      });
    });
  }, [updateStatement]);

  const handleResourceChange = useCallback((
    module: string,
    actionName: string,
    resourceId: string,
    type: "include" | "exclude",
    checked: boolean
  ) => {
    applyResourceChanges(module, actionName, [{resourceId, type, checked}]);
  }, [applyResourceChanges]);

  const handleResourceBatchChange = useCallback((
    module: string,
    actionName: string,
    changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>
  ) => {
    applyResourceChanges(module, actionName, changes);
  }, [applyResourceChanges]);

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

  const renderResourceItems = useCallback((module: string, actionName: string) => {
    const statement = value.find(s => s.module === module);
    const resource = statement ? getActionResource(statement, actionName) : undefined;

    if (!resource) return null;

    // Try to get a custom resource renderer by MODULE (not by action)
    const renderer = resourceRendererRegistry.getRenderer(module);
    const customRendering = renderer.render({
      module,
      actionName,
      resources: [],
      statement,
      onResourceChange: (resourceId: string, type: "include" | "exclude", checked: boolean) => {
        handleResourceChange(module, actionName, resourceId, type, checked);
      }
    });

    // If custom renderer provides UI, use it
    if (customRendering) {
      return customRendering;
    }


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
  }, [handleResourceChange, value]);

  const renderActionContent = useCallback((module: string, actionName: string, acceptsResource: boolean) => {
    if (!acceptsResource) return null;

    const statement = value.find(s => s.module === module);
    const active = statement ? isActionActive(statement, actionName) : false;

    if (!active) return null;

    return renderResourceItems(module, actionName);
  }, [renderResourceItems, value]);

  const formatActionName = useCallback((actionName: string, module: string): string => {
    return actionName
      .replace(`${module}:`, "")
      .replace(/:/g, " ")
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }, []);

  const moduleRendererExtras = useMemo(() => {
    return {
      moduleData,
      onResourceChange: handleResourceChange,
      onResourceBatchChange: handleResourceBatchChange
    };
  }, [handleResourceBatchChange, handleResourceChange, moduleData]);

  const renderModuleContent = useCallback((moduleStatement: ModuleStatement) => {
    const statement = value.find(s => s.module === moduleStatement.module);
    const { renderer, buildProps } = moduleRendererRegistry.getRendererConfig(moduleStatement.module);

    // Build base context that all renderers receive
    const baseContext = {
      moduleStatement,
      statement,
      onActionToggle: (actionName: string, acceptsResource: boolean) => {
        handleActionToggle(moduleStatement.module, actionName, acceptsResource);
      },
      renderActionContent: (actionName: string, acceptsResource: boolean) => {
        return renderActionContent(moduleStatement.module, actionName, acceptsResource);
      },
      formatActionName
    };

    const rendererProps = buildProps ? buildProps(baseContext, moduleRendererExtras) : baseContext;
    return renderer.render(rendererProps);
  }, [formatActionName, handleActionToggle, moduleRendererExtras, renderActionContent, value]);

  // Generate accordion items for modules
  const moduleAccordionItems = useMemo(() => {
    return modules.map(moduleStatement => {
      const statement = value.find(s => s.module === moduleStatement.module);

      const allEnabled = statement ? areAllModuleActionsEnabled(statement, moduleStatement.actions) : false;
      const someEnabled = statement ? statement.actions.length > 0 : false;
      const isIndeterminate = someEnabled && !allEnabled;
      
      // Format module name for display (capitalize and remove colons)
      const moduleLabel = moduleStatement.module
        .split(':')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
      
      return {
        title: (
          <div className={styles.moduleTitleContainer}>
            <span>{moduleLabel}</span>
            <Checkbox
              checked={allEnabled}
              indeterminate={isIndeterminate}
              aria-checked={isIndeterminate ? "mixed" : allEnabled}
              onChange={e => {
                e.stopPropagation();
                handleModuleToggle(moduleStatement.module, !allEnabled);
              }}
              onClick={e => e.stopPropagation()}
              checkBoxClassName={styles.actionCheckbox}
            />
          </div>
        ),
        content: renderModuleContent(moduleStatement)
      };
    });
  }, [handleModuleToggle, modules, renderModuleContent, value]);

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

export default React.memo(Resource);
