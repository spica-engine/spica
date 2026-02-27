/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useMemo, useState} from "react";
import {Accordion, Button, FlexElement, FluidContainer, Icon, Text, type TypeAccordionItem} from "oziko-ui-kit";
import {useGetFunctionsQuery} from "../../../store/api/functionApi";
import type {SpicaFunction} from "../../../store/api/functionApi";
import styles from "./DependencyPanel.module.scss";

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
};

const ImportedFunctionPanel = ({code, onCodeChange}: ImportedFunctionPanelProps) => {
  const [inputValue, setInputValue] = useState("");
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

  const handleAdd = useCallback(() => {
    const id = inputValue.trim();
    if (!id) return;

    const fn = functionsMap[id];
    if (!fn) return;

    if (importedFunctions.some(imp => imp.functionId === id)) return;

    const alias = toPascalCase(fn.name) || "ImportedFn";
    const importLine = `import * as ${alias} from "../../${id}/.build";\n`;
    onCodeChange(importLine + code);
    setInputValue("");
  }, [inputValue, functionsMap, importedFunctions, code, onCodeChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleAdd();
    },
    [handleAdd]
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

  const accordionItems: TypeAccordionItem[] = [
    {
      title: (
        <FlexElement gap={8} alignment="leftCenter">
          <Text size="medium">Imported Functions</Text>
        </FlexElement>
      ),
      content: (
        <FlexElement direction="vertical" dimensionX="fill" gap={10}>
          {importedFunctions.map(imp => {
            const fn = functionsMap[imp.functionId];
            const displayName = fn?.name ?? imp.alias;
            return (
              <FluidContainer
                key={imp.functionId}
                dimensionX="fill"
                mode="fill"
                alignment="leftCenter"
                root={{
                  children: <Text size="medium">{displayName}</Text>,
                  alignment: "leftCenter",
                }}
                suffix={{
                  children: (
                    <Button
                      variant="icon"
                      color="danger"
                      onClick={() => handleDelete(imp.functionId)}
                      className={styles.button}
                    >
                      <Icon name="delete" />
                    </Button>
                  ),
                }}
              />
            );
          })}
          <FlexElement dimensionX="fill" gap={4} className={styles.addDependencyRow}>
            <input
              className={styles.input}
              placeholder="Function ID..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button
              variant="icon"
              color="default"
              onClick={handleAdd}
              disabled={!inputValue.trim()}
            >
              <Icon name="plus" />
            </Button>
          </FlexElement>
        </FlexElement>
      ),
    },
  ];

  return (
    <Accordion
      items={accordionItems}
      suffixOnHover={false}
      noBackgroundOnFocus
    />
  );
};

export default memo(ImportedFunctionPanel);
