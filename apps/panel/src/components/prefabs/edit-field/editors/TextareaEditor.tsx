import React from "react";
import {type EditorProps} from "../types";
import {BaseEditor} from "./BaseEditor";
import styles from "./TextareaEditor.module.scss";

export function TextareaEditor({value, onChange}: EditorProps) {
  return (
    <div className={styles.textareaEditor}>
      <BaseEditor value={value} onChange={onChange} />

      <div className={styles.divider} />

      <div className={styles.configSection}>
        <h4 className={styles.sectionTitle}>Configuration</h4>
      </div>
    </div>
  );
} 

