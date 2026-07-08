import React, {useCallback, useMemo} from "react";
import {useInputRepresenter} from "oziko-ui-kit";
import type {
  TypeChangeEvent,
  TypeInputRepresenterError,
  TypeProperties
} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import JsonFieldInput from "../../molecules/json-field-input/JsonFieldInput";
import RelationFieldInput from "../relation-field-input/RelationFieldInput";
import StorageFieldInput from "../storage-field-input/StorageFieldInput";
import ArrayFieldInput from "../array-field-input/ArrayFieldInput";
import styles from "./ObjectFieldInput.module.scss";

interface ObjectFieldInputProps {
  fieldKey: string;
  title?: string;
  description?: string;
  className?: string;
  value?: any;
  properties?: TypeProperties;
  errors?: TypeInputRepresenterError;
  onChange?: (event: TypeChangeEvent<any>) => void;
}

/**
 * Shared typeOverrides for every recursive input in the bucket entry drawer.
 * oziko's built-in ObjectInput/ArrayInput renderers only descend one level and
 * render an object leaf as a text input showing `String(value)` — i.e. the literal
 * "[object Object]". Recursing through useInputRepresenter with these overrides
 * instead lets every nesting depth resolve to the correct editor, and routes any
 * free-form (schema-less) object/array to a JSON editor rather than a dead leaf.
 */
export const buildBucketInputTypeOverrides = () => ({
  storage: (props: any) => <StorageFieldInput {...props} fieldKey={props.key} />,
  json: (props: any) => <JsonFieldInput {...props} fieldKey={props.key} />,
  relation: (props: any) => <RelationFieldInput {...props} fieldKey={props.key} />,
  array: (props: any) => <ArrayFieldInput {...props} fieldKey={props.key} />,
  object: (props: any) => <ObjectFieldInput {...props} fieldKey={props.key} />
});

const isPlainObject = (value: any): boolean =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const ObjectFieldInput: React.FC<ObjectFieldInputProps> = ({
  fieldKey,
  title,
  description,
  className,
  value,
  properties,
  errors,
  onChange
}) => {
  const hasDeclaredProperties = useMemo(
    () => !!properties && Object.keys(properties).length > 0,
    [properties]
  );

  const overrides = useMemo(() => buildBucketInputTypeOverrides(), []);

  const handleObjectChange = useCallback(
    (nextObject: any) => {
      onChange?.({key: fieldKey, value: nextObject});
    },
    [onChange, fieldKey]
  );

  // Only feed a real object to the representer; a stray "" seed for an untouched
  // field would otherwise be spread across every sub-input as the same value.
  const objectValue = isPlainObject(value) ? value : {};

  const nestedInputs = useInputRepresenter({
    properties: (hasDeclaredProperties ? properties : {}) as TypeProperties,
    value: objectValue,
    onChange: handleObjectChange,
    error: errors,
    typeOverrides: overrides
  });

  if (!hasDeclaredProperties) {
    return (
      <JsonFieldInput
        fieldKey={fieldKey}
        title={title ?? ""}
        description={description}
        value={value}
        className={className}
        onChange={onChange}
      />
    );
  }

  return (
    <div className={`${styles.objectFieldInput} ${className ?? ""}`}>
      {title && <div className={styles.header}>{title}</div>}
      <div className={styles.body}>{nestedInputs}</div>
    </div>
  );
};

export default React.memo(ObjectFieldInput);
