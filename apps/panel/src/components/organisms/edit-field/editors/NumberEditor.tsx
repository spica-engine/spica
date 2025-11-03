// @owner Kanan Gasimov

import React from "react";
import {type EditorProps} from "../types";
import {BaseEditor} from "./BaseEditor";
import {NumberInput, Checkbox} from "oziko-ui-kit";
import styles from "./NumberEditor.module.scss";

export function NumberEditor({value, onChange}: EditorProps) {
  const handleAddEnumeratedValue = (val: number) => {
    const values = value.enumeratedValues || [];
    if (!values.includes(val)) {
      onChange({...value, enumeratedValues: [...values, val]});
    }
  };

  const handleRemoveEnumeratedValue = (val: number) => {
    const values = value.enumeratedValues || [];
    onChange({...value, enumeratedValues: values.filter(v => v !== val)});
  };

  return (
    <div className={styles.numberEditor}>
      <BaseEditor value={value} onChange={onChange} />

      <div className={styles.minMaxSection}>
        <div className={styles.minMaxRow}>
          <NumberInput
            label="Minimum"
            value={value.minimum}
            onChange={minimum => onChange({...value, minimum})}
          />
          <NumberInput
            label="Maximum"
            value={value.maximum}
            onChange={maximum => onChange({...value, maximum})}
          />
        </div>
      </div>

      <div className={styles.enumSection}>
        <Checkbox
          label="Make field enumerated"
          checked={value.enumerated || false}
          onChange={(e) => onChange({...value, enumerated: e.target.checked})}
        />
        
        {value.enumerated && (
          <div className={styles.enumValues}>
            <div className={styles.enumTags}>
              {/* {(value.enumeratedValues || []).map(val => (
                <Tag
                  key={val}
                  label={val.toString()}
                  onRemove={() => handleRemoveEnumeratedValue(val)}
                />
              ))} */}
            </div>
            <NumberInput
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  const target = e.target as HTMLInputElement;
                  const val = parseFloat(target.value);
                  if (!isNaN(val)) {
                    handleAddEnumeratedValue(val);
                    target.value = "";
                  }
                }
              }}
            />
          </div>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.configSection}>
        <h4 className={styles.sectionTitle}>Configuration</h4>
        <div className={styles.defaultValue}>
          <NumberInput
            label="Default Value"
            value={value.default}
            onChange={defaultValue => onChange({...value, default: defaultValue})}
          />
        </div>
      </div>
    </div>
  );
}

