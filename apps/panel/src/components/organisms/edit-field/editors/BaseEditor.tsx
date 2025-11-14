// @owner Kanan Gasimov


import React from "react";
import {type EditorProps} from "../types";
import {StringInput, TextAreaInput} from "oziko-ui-kit";
import styles from "./BaseEditor.module.scss";

export function BaseEditor({value, onChange}: EditorProps) {
  return (
    <div className={styles.baseEditor}>
      <div className={styles.formGroup}>
        <StringInput
          label="Name"
          value={value.name || ""}
          onChange={name => onChange({...value, name})}
          // placeholder="Field name"
        />
      </div>

      <div className={styles.formGroup}>
        <StringInput
          label="Textarea title"
          value={value.title || ""}
          onChange={title => onChange({...value, title})}
          // placeholder="Field title"
        />
      </div>

      <div className={styles.formGroup}>
        <TextAreaInput
          title="Description"
          value={value.description || ""}
          onChange={(e) => onChange({...value, description: e.target.value})}
          placeholder="Description of the input"
        />
      </div>
    </div>
  );
}

