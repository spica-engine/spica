import React, {useMemo, useState} from "react";
import {type EditorProps} from "../types";
import {BaseEditor} from "./BaseEditor";
import {Tab, Checkbox, Select, StringInput, NumberInput} from "oziko-ui-kit";
import styles from "./SelectEditor.module.scss";

const PRESET_OPTIONS = [
  {value: "countries", label: "Countries"},
  {value: "days", label: "Days"},
  {value: "email", label: "Email"},
  {value: "phone", label: "Phone Number"}
];

const TYPE_OPTIONS = [
  {value: "string", label: "string"},
  {value: "number", label: "number"}
];

export function SelectEditor({value, onChange}: EditorProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [inputValue, setInputValue] = useState("");

  const handleAddPreset = (val: string) => {
    const presets = value.presets || [];
    if (val && !presets.includes(val)) {
      onChange({...value, presets: [...presets, val]});
    }
  };

  const handleRemovePreset = (val: string) => {
    const presets = value.presets || [];
    onChange({...value, presets: presets.filter(p => p !== val)});
  };

  const tabs = useMemo(
    () => [
      {
        title: "Presets",
        element: (
          <div className={styles.presetsTab}>
            <Select
              value=""
              onChange={preset => {
                if (preset) {
                  onChange({...value, preset: preset as string});
                }
              }}
              options={PRESET_OPTIONS}
              title="Presets"
            />

            <div className={styles.checkboxes}>
              <Checkbox
                label="Make field enumerated"
                checked={value.enumerated || false}
                onChange={(e) => onChange({...value, enumerated: e.target.checked})}
              />
            </div>

            {value.enumerated && (
              <div className={styles.enumValues}>
                <div className={styles.enumTags}>
                  {/* Tag component will be implemented */}
                  {(value.presets || []).map(val => (
                    <div key={val} className={styles.tag}>
                      {val}
                      <button onClick={() => handleRemovePreset(val)}>×</button>
                    </div>
                  ))}
                </div>
                <StringInput
                  title="Enter a value than press enter"
                  value={inputValue}
                  onChange={setInputValue}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" && inputValue.trim()) {
                      handleAddPreset(inputValue.trim());
                      setInputValue("");
                    }
                  }}
                />
              </div>
            )}

            <div className={styles.checkboxes}>
              <Checkbox
                label="Define Pattern"
                checked={!!value.pattern}
                onChange={(e) => onChange({...value, pattern: e.target.checked ? "" : undefined})}
              />
            </div>

            {value.pattern !== undefined && (
              <StringInput
                label="Regex"
                value={value.pattern}
                onChange={pattern => onChange({...value, pattern})}
              />
            )}
          </div>
        )
      },
      {
        title: "Multiple Selection",
        element: (
          <div className={styles.multipleTab}>
            <Select
              title="Type"
              value={value.selectType || "number"}
              onChange={selectType => onChange({...value, selectType: selectType as string})}
              options={TYPE_OPTIONS}
            />

            <NumberInput
              label="Max Items"
              value={value.maxItems}
              onChange={maxItems => onChange({...value, maxItems})}
            />
          </div>
        )
      },
      {
        title: "Configuration",
        element: (
          <div className={styles.configTab}>
            {/* Configuration options will be added by decorators */}
          </div>
        )
      }
    ],
    [value, inputValue]
  );

  return (
    <div className={styles.selectEditor}>
      <BaseEditor value={value} onChange={onChange} />

      <div className={styles.inputInstruction}>Enter a value than press enter</div>

      <Tab
        type="underline"
        indicatorMode="equal"
        dimensionX="fill"
        items={tabs}
        value={activeTab}
        onChange={setActiveTab}
        className={styles.tab}
      />

      <div className={styles.tabContent}>
        {tabs[activeTab] && tabs[activeTab].element}
      </div>
    </div>
  );
}

