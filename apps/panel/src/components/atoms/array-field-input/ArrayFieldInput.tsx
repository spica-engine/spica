import React, {useCallback, useMemo} from "react";
import {ArrayInput} from "oziko-ui-kit";
import type {TypeChangeEvent} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import ObjectFieldInput from "../object-field-input/ObjectFieldInput";
import JsonFieldInput from "../../molecules/json-field-input/JsonFieldInput";
import styles from "./ArrayFieldInput.module.scss";

interface ArrayFieldInputProps {
  fieldKey: string;
  title: string;
  description?: string;
  className?: string;
  value?: unknown;
  items?: any;
  minItems?: number;
  maxItems?: number;
  errors?: any;
  onChange?: (event: TypeChangeEvent<any>) => void;
}

/**
 * oziko's default `array` renderer forwards the raw value straight to ArrayInput,
 * which does `value.map(...)`. When the form value is empty the drawer passes "" for
 * every field, and during the outside-click close transition an array field can hold a
 * non-array transient — both throw "map is not a function" inside oziko. Coercing to an
 * array here (the exact prop oziko maps) makes that crash unreachable. onChange still
 * keys on `title`, matching oziko's own array renderer, so save behavior is unchanged.
 *
 * Arrays of objects and free-form arrays are additionally special-cased: oziko renders
 * each item through its own useInputRepresenter WITHOUT our typeOverrides, so nested
 * object leaves collapse to "[object Object]" and schema-less items get no editor at all.
 * We render those ourselves — one recursive ObjectFieldInput per item, or a single JSON
 * editor for a fully free-form array — so no array item can ever show "[object Object]".
 */
const ArrayFieldInput: React.FC<ArrayFieldInputProps> = ({
  fieldKey,
  title,
  description,
  className,
  value,
  items,
  minItems,
  maxItems,
  errors,
  onChange
}) => {
  const itemType: string | undefined = items?.type;
  const itemProperties = items?.properties;
  const hasItemProperties = useMemo(
    () => !!itemProperties && Object.keys(itemProperties).length > 0,
    [itemProperties]
  );

  const useObjectItems = itemType === "object" && hasItemProperties;
  // No usable item schema → the user must edit the whole array as raw JSON.
  const useFreeFormJson = !items || (itemType === "object" && !hasItemProperties) || itemType === "array";

  const currentItems: any[] = Array.isArray(value) ? value : [];

  const emitArray = useCallback(
    (next: any[]) => {
      onChange?.({key: fieldKey, value: next});
    },
    [onChange, fieldKey]
  );

  const handleAdd = useCallback(() => {
    if (maxItems != null && currentItems.length >= maxItems) return;
    emitArray([...currentItems, {}]);
  }, [emitArray, currentItems, maxItems]);

  const safeValue = useMemo(() => {
    if (Array.isArray(value)) return value;
    // undefined/null is already guarded inside oziko (and seeds a default item);
    // any other non-array (e.g. "" or a stray object) would throw on `.map`.
    if (value == null) return value as undefined;
    return [];
  }, [value]);

  const handleChange = useCallback(
    (next: any) => {
      onChange?.({key: title, value: next});
    },
    [onChange, title]
  );

  if (useObjectItems) {
    const canRemove = minItems == null || currentItems.length > minItems;
    const canAdd = maxItems == null || currentItems.length < maxItems;

    return (
      <div className={`${styles.arrayFieldInput} ${className ?? ""}`}>
        {title && <div className={styles.header}>{title}</div>}
        <div className={styles.items}>
          {currentItems.map((item, index) => (
            <div className={styles.item} key={index}>
              <div className={styles.itemHeader}>
                <span className={styles.itemIndex}>{index}</span>
                <button
                  type="button"
                  className={styles.itemRemove}
                  onClick={() => emitArray(currentItems.filter((_, i) => i !== index))}
                  disabled={!canRemove}
                  aria-label={`Remove item ${index}`}
                >
                  Remove
                </button>
              </div>
              <ObjectFieldInput
                fieldKey={`${fieldKey}.${index}`}
                properties={itemProperties}
                value={item}
                onChange={next => {
                  const nextItems = currentItems.slice();
                  nextItems[index] = next.value;
                  emitArray(nextItems);
                }}
              />
            </div>
          ))}
        </div>
        <button type="button" className={styles.addButton} onClick={handleAdd} disabled={!canAdd}>
          Add item
        </button>
      </div>
    );
  }

  if (useFreeFormJson) {
    return (
      <JsonFieldInput
        fieldKey={fieldKey}
        title={title}
        description={description}
        value={value}
        className={className}
        onChange={onChange}
      />
    );
  }

  return (
    <ArrayInput
      title={title}
      description={description}
      value={safeValue as any}
      onChange={handleChange}
      minItems={minItems}
      maxItems={maxItems}
      items={items}
      propertyKey={fieldKey}
      errors={errors}
      className={className}
    />
  );
};

export default React.memo(ArrayFieldInput);
