/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useState} from "react";
import {Accordion, Button, FlexElement, FluidContainer, Icon, Text, type TypeAccordionItem} from "oziko-ui-kit";
import {
  useGetFunctionDependenciesQuery,
  useAddFunctionDependencyMutation,
  useDeleteFunctionDependencyMutation,
} from "../../../store/api/functionApi";
import type {Dependency} from "../../../store/api/functionApi";
import styles from "./DependencyPanel.module.scss";

type DependencyPanelProps = {
  functionId: string;
};

const DependencyPanel = ({functionId}: DependencyPanelProps) => {
  const [newDependency, setNewDependency] = useState("");
  const {data: depsRaw, isLoading} = useGetFunctionDependenciesQuery(functionId);
  const [addDependency, {isLoading: isInstalling}] = useAddFunctionDependencyMutation();
  const [deleteDependency, {isLoading: isRemoving}] = useDeleteFunctionDependencyMutation();

  let dependencies: Dependency[] = [];
  if (Array.isArray(depsRaw)) {
    dependencies = depsRaw;
  } else if (depsRaw) {
    dependencies = Object.entries(depsRaw).map(([name, version]) => ({name, version: String(version)}));
  }

  const isPending = isInstalling || isRemoving;

  const handleAdd = useCallback(async () => {
    const name = newDependency.trim();
    if (!name) return;
    try {
      await addDependency({id: functionId, name}).unwrap();
      setNewDependency("");
    } catch {
      // error handled by RTK Query
    }
  }, [newDependency, functionId, addDependency]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleAdd();
    },
    [handleAdd]
  );

  const handleDelete = useCallback(
    async (name: string) => {
      try {
        await deleteDependency({id: functionId, name}).unwrap();
      } catch {
        // error handled by RTK Query
      }
    },
    [functionId, deleteDependency]
  );

  const handleUpdate = useCallback(
    async (name: string) => {
      try {
        await addDependency({id: functionId, name: `${name}@latest`}).unwrap();
      } catch {
        // error handled by RTK Query
      }
    },
    [functionId, addDependency]
  );

  const accordionItems: TypeAccordionItem[] = [
    {
      title: (
        <FlexElement gap={8} alignment="leftCenter">
          <Text size="medium">Dependencies</Text>
          {isPending && <span className={styles.spinner} />}
        </FlexElement>
      ),
      content: (
        <FlexElement direction="vertical" dimensionX="fill" gap={10}>
          {isLoading && <Text size="small">Loading...</Text>}
          {!isLoading &&
            dependencies.map(dep => (
              <FluidContainer
                key={dep.name}
                dimensionX="fill"
                mode="fill"
                alignment="leftCenter"
                root={{
                  children: (
                    <Text size="medium">
                      {dep.name} @{dep.version}
                    </Text>
                  ),
                  alignment: "leftCenter",
                }}
                suffix={{
                  children: (
                    <>
                      <Button
                        variant="icon"
                        color="default"
                        onClick={() => handleUpdate(dep.name)}
                        disabled={isPending}
                        className={styles.button}
                      >
                        <Icon name="refresh" />
                      </Button>
                      <Button
                        variant="icon"
                        color="danger"
                        onClick={() => handleDelete(dep.name)}
                        disabled={isPending}
                        className={styles.button}
                      >
                        <Icon name="delete" />
                      </Button>
                    </>
                  )
                }}
              />
            ))}
          <FlexElement dimensionX="fill" gap={4} className={styles.addDependencyRow}>
            <input
              className={styles.input}
              placeholder="Package name"
              value={newDependency}
              onChange={e => setNewDependency(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isPending}
            />
            <Button
              variant="icon"
              color="default"
              onClick={handleAdd}
              disabled={isPending || !newDependency.trim()}
            >
              <Icon name="plus" />
            </Button>
          </FlexElement>
        </FlexElement>
      )
    }
  ];

  return (
    <Accordion
      items={accordionItems}
      suffixOnHover={false}
      noBackgroundOnFocus
    />
  );
};

export default memo(DependencyPanel);
