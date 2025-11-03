// @owner Kanan Gasimov

import React from "react";
import {type EditorProps} from "../types";
import {BaseEditor} from "./BaseEditor";
import {Checkbox} from "oziko-ui-kit";
import styles from "./BooleanEditor.module.scss";

export function BooleanEditor({value, onChange}: EditorProps) {
  return (
    <div className={styles.booleanEditor}>
      <BaseEditor value={value} onChange={onChange} />

      <div className={styles.divider} />

      <div className={styles.configSection}>
        <h4 className={styles.sectionTitle}>Configuration</h4>
        <div className={styles.defaultValue}>
          <Checkbox
            label="Default value"
            checked={value.default || false}
            onChange={(e) => onChange({...value, default: e.target.checked})}
          />
        </div>
      </div>
    </div>
  );
}

