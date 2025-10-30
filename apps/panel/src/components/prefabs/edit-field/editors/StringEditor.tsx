import React from "react";
import {type EditorProps} from "../types";
import {BaseEditor} from "./BaseEditor";
import {StringInput} from "oziko-ui-kit";
import styles from "./StringEditor.module.scss";

export function StringEditor({value, onChange}: EditorProps) {
  return (
    <div className={styles.stringEditor}>
      <BaseEditor value={value} onChange={onChange} />
      
      <div className={styles.divider} />
      
      <div className={styles.configSection}>
        <h4 className={styles.sectionTitle}>Configuration</h4>
        <div className={styles.defaultValue}>
          <StringInput
            label="Default Value"
            value={value.default || ""}
            onChange={defaultValue => onChange({...value, default: defaultValue})}
          />
        </div>
      </div>
    </div>
  );
}

