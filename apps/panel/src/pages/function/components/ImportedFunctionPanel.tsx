/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useMemo, useState} from "react";
import {
  Button,
  FlexElement,
  Icon,
  Select,
} from "oziko-ui-kit";
import type {TypeLabeledValue} from "oziko-ui-kit";
import {useGetFunctionsQuery} from "../../../store/api/functionApi";
import type {SpicaFunction} from "../../../store/api/functionApi";
import styles from "./ImportedFunctionPanel.module.scss";

const IMPORT_REGEX = /^import\s+\*\s+as\s+(\w+)\s+from\s+["']\.\.\/\.\.\/([^/]+)\/\.build["'];?\s*$/gm;

function toPascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

type ImportedFunction = {
  alias: string;
  functionId: string;
};

type ImportedFunctionPanelProps = {
  code: string;
  onCodeChange: (newCode: string) => void;
  currentFunctionId?: string;
};

const ImportedFunctionPanel = ({code, onCodeChange, currentFunctionId}: ImportedFunctionPanelProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const {data: functionsResponse} = useGetFunctionsQuery();
  const functionList = Array.isArray(functionsResponse) ? functionsResponse : functionsResponse?.data;

  const functionsMap = useMemo<Record<string, SpicaFunction>>(() => {
    if (!functionList) return {};
    return functionList.reduce<Record<string, SpicaFunction>>((acc, fn) => {
      if (fn._id) acc[fn._id] = fn;
      return acc;
    }, {});
  }, [functionList]);

  const importedFunctions = useMemo<ImportedFunction[]>(() => {
    const results: ImportedFunction[] = [];
    let match: RegExpExecArray | null;
    const re = new RegExp(IMPORT_REGEX.source, IMPORT_REGEX.flags);
    while ((match = re.exec(code)) !== null) {
      results.push({alias: match[1], functionId: match[2]});
    }
    return results;
  }, [code]);

  const importedFunctionIdSet = useMemo(
    () => new Set(importedFunctions.map(imp => imp.functionId)),
    [importedFunctions]
  );

  const selectOptions = useMemo<TypeLabeledValue[]>(() => {
    if (!functionList) return [];
    return functionList
      .filter(fn => fn._id && fn._id !== currentFunctionId && !importedFunctionIdSet.has(fn._id))
      .map(fn => ({value: fn._id as string, label: fn.name}));
  }, [functionList, currentFunctionId, importedFunctionIdSet]);

  const handleAdd = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;

      const importLines = ids
        .map(id => {
          const fn = functionsMap[id];
          const alias = fn ? toPascalCase(fn.name) || "ImportedFn" : "ImportedFn";
          return `import * as ${alias} from "../../${id}/.build";\n`;
        })
        .join("");

      onCodeChange(importLines + code);
      setSelectedIds([]);
    },
    [functionsMap, code, onCodeChange]
  );

  const handleDelete = useCallback(
    (functionId: string) => {
      const lineRegex = new RegExp(
        `^import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+["']\\.\\./\\.\\./` +
          functionId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
          `/\\.build["'];?\\s*\\n?`,
        "gm"
      );
      onCodeChange(code.replace(lineRegex, ""));
    },
    [code, onCodeChange]
  );

  return (
    <FlexElement direction="vertical" dimensionX="fill" alignment="leftCenter" gap={8} className={styles.addRow}>
      <div className={styles.selectWrapper}>
        <Select
          options={selectOptions}
          value={selectedIds}
          multiple
          placeholder="Select functions to import..."
          popupClassName={styles.importSelectDropdown}
          onChange={value => {
            const ids = Array.isArray(value) ? (value as string[]) : [];
            setSelectedIds(ids);
            if (ids.length) handleAdd(ids);
          }}
          dimensionX="fill"
        />
      </div>

      {importedFunctions.length === 0 ? (
        <div className={styles.emptyState}>
          <Icon name="codeTags" size="md" />
          <span>No imported functions</span>
        </div>
      ) : (
        <FlexElement className={styles.fnList} dimensionX="fill" direction="vertical" gap={4}>
          {importedFunctions.map(imp => {
            const fn = functionsMap[imp.functionId];
            const displayName = fn?.name ?? imp.alias;
            return (
              <FlexElement key={imp.functionId} className={styles.fnItem} dimensionX="fill">
                <div className={styles.fnIcon}>
                  <Icon name="codeTags" size="sm" />
                </div>
                <div className={styles.fnInfo}>
                  <div className={styles.fnName}>{displayName}</div>
                  <div className={styles.fnAlias}>as {imp.alias}</div>
                </div>
                <div className={styles.fnActions}>
                  <Button
                    variant="icon"
                    color="danger"
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(imp.functionId)}
                    title="Remove import"
                  >
                    <Icon name="delete" size="sm" />
                  </Button>
                </div>
              </FlexElement>
            );
          })}
        </FlexElement>
      )}
    </FlexElement>
  );
};

export default memo(ImportedFunctionPanel);
