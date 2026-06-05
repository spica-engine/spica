/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useState} from "react";
import {Button, FlexElement, Icon} from "oziko-ui-kit";
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

  // Imported functions are installed as `@spica-fn/*` dependencies but are
  // surfaced in the dedicated "Imported Functions" panel, so keep them out of
  // the npm dependency list here.
  dependencies = dependencies.filter(dep => !dep.name.startsWith("@spica-fn/"));

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

  return (
    <FlexElement direction="vertical" dimensionX="fill" gap={0}>
      {isLoading ? (
        <div className={styles.emptyState}>
          <Icon name="refresh" size="md" />
          <span>Loading dependencies…</span>
        </div>
      ) : dependencies.length === 0 ? (
        <div className={styles.emptyState}>
          <Icon name="layers" size="md" />
          <span>No packages installed</span>
        </div>
      ) : (
        <div className={styles.depList}>
          {dependencies.map(dep => (
            <div key={dep.name} className={styles.depItem}>
              <span className={styles.depName} title={`${dep.name} ${dep.version}`.trim()}>
                {[dep.name, dep.version].filter(Boolean).join(" ")}
              </span>
              <div className={styles.depActions}>
                <Button
                  variant="icon"
                  color="default"
                  onClick={() => handleUpdate(dep.name)}
                  disabled={isPending}
                  className={styles.actionButton}
                  title="Update to latest"
                >
                  <Icon name="refresh" size="sm" />
                </Button>
                <Button
                  variant="icon"
                  color="danger"
                  onClick={() => handleDelete(dep.name)}
                  disabled={isPending}
                  className={styles.actionButton}
                >
                  <Icon name="delete" size="sm" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className={styles.addRow}>
        <input
          className={styles.addInput}
          placeholder="Package name (e.g. lodash@4)"
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
          className={styles.submitButton}
        >
          <Icon name="plus" size="sm" />
        </Button>
      </div>
    </FlexElement>
  );
};

export default memo(DependencyPanel);
