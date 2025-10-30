import React from "react";
import {type EditorProps} from "../types";
import {BaseEditor} from "./BaseEditor";
import {Select} from "oziko-ui-kit";
import styles from "./DateEditor.module.scss";

const DEFAULT_DATE_OPTIONS = [
  {value: "none", label: "No Default"},
  {value: "createdAt", label: "Created At"},
  {value: "updatedAt", label: "Updated At"}
];

export function DateEditor({value, onChange}: EditorProps) {
  return (
    <div className={styles.dateEditor}>
      <BaseEditor value={value} onChange={onChange} />

      <div className={styles.divider} />

      <div className={styles.configSection}>
        <h4 className={styles.sectionTitle}>Configuration</h4>
        <div className={styles.defaultDate}>
          <Select
            label="Default Date"
            value={value.defaultDate || "none"}
            onChange={(value: string) => onChange({...value, defaultDate: value})}
            options={DEFAULT_DATE_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
}

