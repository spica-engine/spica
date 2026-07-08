import {memo, useCallback} from "react";
import styles from "./DateRangePicker.module.scss";

export type RangePreset = "1h" | "24h" | "7d" | "30d" | "custom";

export type DateRange = {begin: string; end: string};

type DateRangePickerProps = {
  preset: RangePreset;
  range: DateRange;
  onChange: (preset: RangePreset, range: DateRange) => void;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const PRESETS: {key: Exclude<RangePreset, "custom">; label: string; span: number}[] = [
  {key: "1h", label: "Last 1h", span: HOUR},
  {key: "24h", label: "Last 24h", span: DAY},
  {key: "7d", label: "Last 7d", span: 7 * DAY},
  {key: "30d", label: "Last 30d", span: 30 * DAY}
];

const pad = (value: number) => String(value).padStart(2, "0");

// datetime-local inputs speak local wall-clock time, so ISO is projected to the
// browser timezone on the way in and back to ISO on the way out.
const toLocalInput = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const fromLocalInput = (value: string): string | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const DateRangePicker = ({preset, range, onChange}: DateRangePickerProps) => {
  const handlePreset = useCallback(
    (key: Exclude<RangePreset, "custom">, span: number) => {
      const end = new Date();
      const begin = new Date(end.getTime() - span);
      onChange(key, {begin: begin.toISOString(), end: end.toISOString()});
    },
    [onChange]
  );

  const handleCustom = useCallback(
    (edge: "begin" | "end", value: string) => {
      const iso = fromLocalInput(value);
      if (!iso) return;
      onChange("custom", {...range, [edge]: iso});
    },
    [onChange, range]
  );

  return (
    <div className={styles.dateRangePicker}>
      <div className={styles.presets}>
        {PRESETS.map(item => (
          <button
            key={item.key}
            type="button"
            className={`${styles.presetButton} ${preset === item.key ? styles.active : ""}`}
            onClick={() => handlePreset(item.key, item.span)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.custom}>
        <input
          type="datetime-local"
          className={styles.input}
          value={toLocalInput(range.begin)}
          max={toLocalInput(range.end)}
          onChange={event => handleCustom("begin", event.target.value)}
          aria-label="Range start"
        />
        <span className={styles.separator}>–</span>
        <input
          type="datetime-local"
          className={styles.input}
          value={toLocalInput(range.end)}
          min={toLocalInput(range.begin)}
          onChange={event => handleCustom("end", event.target.value)}
          aria-label="Range end"
        />
      </div>
    </div>
  );
};

export default memo(DateRangePicker);
