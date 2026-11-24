import React, {memo, useMemo, useRef, type ReactNode} from "react";
import {Select, Switch, Text} from "oziko-ui-kit";
import {parsePlaceholder, toPlaceholder, type PlaceholderReference} from "../../../domain/placeholder";
import styles from "./DynamicValueField.module.scss";

type KeyList = string[] | null;

type DynamicValueFieldProps = {
  label: string;
  value: number | string;
  defaultStaticValue: number;
  envVarKeys: KeyList;
  attachedPlaceholders: ReadonlySet<string>;
  disabledHint?: string;
  onChange: (value: number | string) => void;
  renderStatic: (value: number) => ReactNode;
};

// oziko-ui-kit's Select defaults `options` to a new [] every render and re-runs its position effect on it, which loops forever when only `groups` is given.
const NO_OPTIONS: never[] = [];

const isMissingEnvVar = (reference: PlaceholderReference | null, keys: KeyList) =>
  reference?.source === "ENV" && keys !== null && !keys.includes(reference.key);

const envVarGroup = (keys: KeyList, reference: PlaceholderReference | null) => {
  const items = (keys ?? []).map(key => ({
    label: key,
    value: toPlaceholder({source: "ENV", key})
  }));
  if (reference?.source === "ENV" && (keys === null || isMissingEnvVar(reference, keys))) {
    const suffix = keys === null ? "" : " (not found)";
    items.push({label: `${reference.key}${suffix}`, value: toPlaceholder(reference)});
  }
  return {label: "Environment variables", items};
};

const savedSecretGroup = (reference: PlaceholderReference | null) =>
  reference?.source === "SECRET"
    ? [
        {
          label: "Secrets",
          items: [{label: `${reference.key} (secret)`, value: toPlaceholder(reference)}]
        }
      ]
    : [];

const DynamicValueField = ({
  label,
  value,
  defaultStaticValue,
  envVarKeys,
  attachedPlaceholders,
  disabledHint,
  onChange,
  renderStatic
}: DynamicValueFieldProps) => {
  const isDynamic = typeof value === "string";
  const lastStaticValue = useRef(defaultStaticValue);
  if (typeof value === "number") {
    lastStaticValue.current = value;
  }

  const reference = parsePlaceholder(value);
  const groups = useMemo(
    () =>
      [envVarGroup(envVarKeys, reference), ...savedSecretGroup(reference)].filter(
        group => group.items.length > 0
      ),
    [envVarKeys, reference?.source, reference?.key]
  );
  const isMissing = isMissingEnvVar(reference, envVarKeys);
  const needsAttaching =
    reference?.source === "ENV" &&
    envVarKeys !== null &&
    !isMissing &&
    !attachedPlaceholders.has(value as string);

  return (
    <div className={styles.field}>
      <div className={styles.header}>
        <Text size="small" className={styles.label}>
          {label}
        </Text>
        <div className={styles.mode}>
          <Text size="small" className={styles.hint}>
            Dynamic
          </Text>
          <Switch
            checked={isDynamic}
            disabled={!!disabledHint}
            size="small"
            onChange={dynamic => onChange(dynamic ? "" : lastStaticValue.current)}
          />
        </div>
      </div>
      {disabledHint && (
        <Text size="small" className={styles.hint}>
          {disabledHint}
        </Text>
      )}
      {isDynamic ? (
        <>
          <Select
            options={NO_OPTIONS}
            groups={groups}
            value={value}
            placeholder="Select an environment variable"
            searchable
            dimensionX="fill"
            onChange={selected => onChange(selected as string)}
          />
          {isMissing && (
            <Text size="small" className={styles.warning}>
              {reference?.key} no longer exists, the default is used.
            </Text>
          )}
          {needsAttaching && (
            <Text size="small" className={styles.hint}>
              It will be attached to this function when you save.
            </Text>
          )}
        </>
      ) : (
        renderStatic(value)
      )}
    </div>
  );
};

export default memo(DynamicValueField);
