/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useState} from "react";
import {Button, FlexElement, Icon, Text} from "oziko-ui-kit";
import styles from "../FunctionPage.module.scss";

type EnvironmentPanelProps = {
  env: Record<string, string>;
  onChange: (env: Record<string, string>) => void;
};

type EnvEntry = {key: string; value: string};

const EnvironmentPanel = ({env, onChange}: EnvironmentPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const entries: EnvEntry[] = Object.entries(env).map(([key, value]) => ({key, value}));

  const toggleExpanded = useCallback(() => setExpanded(prev => !prev), []);

  const commitEntries = useCallback(
    (updated: EnvEntry[]) => {
      const result: Record<string, string> = {};
      for (const entry of updated) {
        if (entry.key && entry.value) {
          result[entry.key] = entry.value;
        }
      }
      onChange(result);
    },
    [onChange]
  );

  const handleAdd = useCallback(() => {
    const updated = [...entries, {key: "", value: ""}];
    commitEntries(updated);
    setEditingIndex(updated.length - 1);
  }, [entries, commitEntries]);

  const handleDelete = useCallback(
    (index: number) => {
      const updated = entries.filter((_, i) => i !== index);
      commitEntries(updated);
      if (editingIndex === index) setEditingIndex(null);
    },
    [entries, commitEntries, editingIndex]
  );

  const handleKeyChange = useCallback(
    (index: number, newKey: string) => {
      const updated = entries.map((e, i) => (i === index ? {key: newKey, value: e.value} : e));
      commitEntries(updated);
    },
    [entries, commitEntries]
  );

  const handleValueChange = useCallback(
    (index: number, newValue: string) => {
      const updated = entries.map((e, i) => (i === index ? {key: e.key, value: newValue} : e));
      commitEntries(updated);
    },
    [entries, commitEntries]
  );

  return (
    <div className={styles.sidebarSection}>
      <div className={styles.sectionHeader} onClick={toggleExpanded}>
        <Icon name={expanded ? "chevronDown" : "chevronRight"} size="sm" />
        <Text size="medium">Environment Variables</Text>
      </div>
      {expanded && (
        <div className={styles.sectionContent}>
          {entries.map((entry, index) => {
            const isEditing = editingIndex === index;
            return (
              <div key={index} className={styles.envItem}>
                {!isEditing ? (
                  <FlexElement
                    dimensionX="fill"
                    alignment="spaceBetween"
                    className={styles.envDisplay}
                  >
                    <Text size="small" className={styles.envText}>
                      {entry.key}={entry.value}
                    </Text>
                    <FlexElement gap={4}>
                      <Button
                        variant="icon"
                        color="transparent"
                        onClick={() => setEditingIndex(index)}
                      >
                        <Icon name="pencil" size="sm" />
                      </Button>
                      <Button
                        variant="icon"
                        color="transparent"
                        onClick={() => handleDelete(index)}
                      >
                        <Icon name="delete" size="sm" />
                      </Button>
                    </FlexElement>
                  </FlexElement>
                ) : (
                  <div className={styles.envForm}>
                    <input
                      className={styles.input}
                      placeholder="Key"
                      value={entry.key}
                      onChange={e => handleKeyChange(index, e.target.value)}
                      onKeyDown={e => e.key === "Enter" && setEditingIndex(null)}
                    />
                    <textarea
                      className={styles.input}
                      placeholder="Value"
                      value={entry.value}
                      rows={1}
                      onChange={e => handleValueChange(index, e.target.value)}
                      onKeyDown={e => e.key === "Enter" && setEditingIndex(null)}
                    />
                    <Button
                      variant="icon"
                      color="transparent"
                      onClick={() => setEditingIndex(null)}
                    >
                      <Icon name="check" size="sm" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          <Button
            variant="text"
            color="default"
            onClick={handleAdd}
            className={styles.addButton}
          >
            <Icon name="plus" size="sm" />
            Add Variable
          </Button>
        </div>
      )}
    </div>
  );
};

export default memo(EnvironmentPanel);
