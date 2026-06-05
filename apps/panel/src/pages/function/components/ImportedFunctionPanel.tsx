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
import {
  useGetFunctionsQuery,
  useGetFunctionDependenciesQuery,
  useAddFunctionDependencyMutation,
  useDeleteFunctionDependencyMutation,
} from "../../../store/api/functionApi";
import type {SpicaFunction} from "../../../store/api/functionApi";
import styles from "./ImportedFunctionPanel.module.scss";

// Imported functions are installed as `@spica-fn/<FunctionName>` dependencies
// (npm-like, file: linked to the sibling function on disk) and used in code as
//   import * as <Alias> from "@spica-fn/<FunctionName>";
const SPICA_FN_SCOPE = "@spica-fn/";

// Matches: import * as Alias from "@spica-fn/Name";
const IMPORT_REGEX = /^import\s+\*\s+as\s+(\w+)\s+from\s+["']@spica-fn\/([^"']+)["'];?\s*$/gm;

function toPascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dependencyNames(depsRaw: unknown): string[] {
  if (!depsRaw) return [];
  if (Array.isArray(depsRaw)) return depsRaw.map((d: any) => d?.name).filter(Boolean);
  return Object.keys(depsRaw as Record<string, unknown>);
}

type ImportedFunctionPanelProps = {
  code: string;
  onCodeChange: (newCode: string) => void;
  currentFunctionId?: string;
};

const ImportedFunctionPanel = ({code, onCodeChange, currentFunctionId}: ImportedFunctionPanelProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {data: functionsResponse} = useGetFunctionsQuery();
  const {data: depsRaw} = useGetFunctionDependenciesQuery(currentFunctionId ?? "", {
    skip: !currentFunctionId
  });
  const [addDependency, {isLoading: isInstalling}] = useAddFunctionDependencyMutation();
  const [deleteDependency] = useDeleteFunctionDependencyMutation();

  const functionList = Array.isArray(functionsResponse) ? functionsResponse : functionsResponse?.data;

  const functionsById = useMemo<Record<string, SpicaFunction>>(() => {
    const map: Record<string, SpicaFunction> = {};
    (functionList ?? []).forEach(fn => {
      if (fn._id) map[fn._id] = fn;
    });
    return map;
  }, [functionList]);

  const functionsByName = useMemo<Record<string, SpicaFunction>>(() => {
    const map: Record<string, SpicaFunction> = {};
    (functionList ?? []).forEach(fn => {
      if (fn.name) map[fn.name] = fn;
    });
    return map;
  }, [functionList]);

  // The alias actually used in the code, keyed by the imported function name.
  const aliasByName = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    const re = new RegExp(IMPORT_REGEX.source, IMPORT_REGEX.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(code)) !== null) {
      map[match[2]] = match[1];
    }
    return map;
  }, [code]);

  // Source of truth: the installed @spica-fn/* dependencies of this function.
  const importedNames = useMemo<string[]>(
    () =>
      dependencyNames(depsRaw)
        .filter(name => name.startsWith(SPICA_FN_SCOPE))
        .map(name => name.slice(SPICA_FN_SCOPE.length)),
    [depsRaw]
  );

  const importedNameSet = useMemo(() => new Set(importedNames), [importedNames]);

  const selectOptions = useMemo<TypeLabeledValue[]>(() => {
    if (!functionList) return [];
    return functionList
      .filter(fn => fn._id && fn._id !== currentFunctionId && !importedNameSet.has(fn.name))
      .map(fn => ({value: fn._id as string, label: fn.name}));
  }, [functionList, currentFunctionId, importedNameSet]);

  const handleAdd = useCallback(
    (ids: string[]) => {
      if (!currentFunctionId || !ids.length) return;

      const importLines: string[] = [];
      ids.forEach(id => {
        const fn = functionsById[id];
        if (!fn?.name) return;

        // Install the function as an npm-like dependency.
        addDependency({id: currentFunctionId, name: SPICA_FN_SCOPE + fn.name});

        // Add the import statement (skip if it is already present).
        const alreadyImported = new RegExp(
          `from\\s+["']${escapeRegExp(SPICA_FN_SCOPE + fn.name)}["']`
        ).test(code);
        if (!alreadyImported) {
          const alias = toPascalCase(fn.name) || "ImportedFn";
          importLines.push(`import * as ${alias} from "${SPICA_FN_SCOPE}${fn.name}";\n`);
        }
      });

      if (importLines.length) onCodeChange(importLines.join("") + code);
      setSelectedIds([]);
    },
    [currentFunctionId, functionsById, addDependency, code, onCodeChange]
  );

  const handleDelete = useCallback(
    (fnName: string) => {
      if (currentFunctionId) {
        deleteDependency({id: currentFunctionId, name: SPICA_FN_SCOPE + fnName});
      }
      const lineRegex = new RegExp(
        `^import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+["']${escapeRegExp(SPICA_FN_SCOPE + fnName)}["'];?\\s*\\n?`,
        "gm"
      );
      onCodeChange(code.replace(lineRegex, ""));
    },
    [currentFunctionId, deleteDependency, code, onCodeChange]
  );

  return (
    <FlexElement direction="vertical" dimensionX="fill" alignment="leftCenter" gap={8} className={styles.addRow}>
      <div className={styles.selectWrapper}>
        <Select
          options={selectOptions}
          value={selectedIds}
          multiple
          placeholder={isInstalling ? "Installing…" : "Select functions to import..."}
          popupClassName={styles.importSelectDropdown}
          onChange={value => {
            const ids = Array.isArray(value) ? (value as string[]) : [];
            setSelectedIds(ids);
            if (ids.length) handleAdd(ids);
          }}
          dimensionX="fill"
        />
      </div>

      {importedNames.length === 0 ? (
        <div className={styles.emptyState}>
          <Icon name="codeTags" size="md" />
          <span>No imported functions</span>
        </div>
      ) : (
        <FlexElement className={styles.fnList} dimensionX="fill" direction="vertical" gap={4}>
          {importedNames.map(name => {
            const fn = functionsByName[name];
            const alias = aliasByName[name] ?? toPascalCase(name);
            return (
              <FlexElement key={name} className={styles.fnItem} dimensionX="fill">
                <div className={styles.fnIcon}>
                  <Icon name="codeTags" size="sm" />
                </div>
                <div className={styles.fnInfo}>
                  <div className={styles.fnName}>{fn?.name ?? name}</div>
                  <div className={styles.fnAlias}>
                    {SPICA_FN_SCOPE}
                    {name}
                    {alias ? ` · as ${alias}` : ""}
                  </div>
                </div>
                <div className={styles.fnActions}>
                  <Button
                    variant="icon"
                    color="danger"
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(name)}
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
