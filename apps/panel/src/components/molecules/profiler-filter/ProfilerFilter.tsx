import {type FC, memo} from "react";
import styles from "./ProfilerFilter.module.scss";
import {
  FlexElement,
  FluidContainer,
  Text,
  Select,
  Input,
  Chip,
  DatePicker,
  Icon,
  Button,
} from "oziko-ui-kit";
import {useFormik} from "formik";
import {
  PROFILER_TIMESTAMP_PRESETS,
  OP_OPTIONS,
  createProfilerFilterDefaultValues,
  type ProfilerFilterValues,
} from "../../../utils/profilerFilter";

const OP_SELECT_OPTIONS = OP_OPTIONS.filter(o => o.value !== "").map(o => ({
  label: o.label,
  value: o.value,
}));

type ProfilerFilterProps = {
  onApply?: (filter: ProfilerFilterValues) => void;
  onCancel?: () => void;
  initialValues?: ProfilerFilterValues;
};

const ProfilerFilter: FC<ProfilerFilterProps> = ({onApply, onCancel, initialValues}) => {
  const formik = useFormik({
    initialValues: initialValues ?? createProfilerFilterDefaultValues(),
    enableReinitialize: true,
    onSubmit: values => onApply?.(values),
  });

  const handleCancel = () => {
    formik.resetForm();
    onCancel?.();
  };

  return (
    <form onSubmit={formik.handleSubmit}>
      <FlexElement dimensionX={515} gap={10} className={styles.container} direction="vertical">
        {/* Operation */}
        <FluidContainer
          dimensionX="fill"
          dimensionY={25}
          prefix={{
            children: <Text>Operation</Text>,
            dimensionX: "fill",
            dimensionY: "fill",
            alignment: "leftCenter",
          }}
          suffix={{
            children: (
              <Select
                dimensionY="fill"
                options={OP_SELECT_OPTIONS}
                value={formik.values.op}
                onChange={v => formik.setFieldValue("op", v)}
                dimensionX={200}
                alignment="rightCenter"
                placeholder="All"
                multiple
                className={`${styles.select} ${styles.content}`}
              />
            ),
            dimensionY: "fill",
          }}
        />

        {/* Time Consumed */}
        <FluidContainer
          dimensionX="fill"
          dimensionY={25}
          prefix={{
            children: <Text>Time Consumed (ms)</Text>,
            dimensionX: "fill",
            alignment: "leftCenter",
          }}
          suffix={{
            children: (
              <FlexElement className={styles.content} dimensionY="fill" gap={10}>
                <Input
                  value={formik.values.millis.min ?? ""}
                  type="number"
                  dimensionX={90}
                  placeholder="Min"
                  onChange={e =>
                    formik.setFieldValue(
                      "millis.min",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />
                <div className={styles.separator} />
                <Input
                  value={formik.values.millis.max ?? ""}
                  type="number"
                  dimensionX={90}
                  placeholder="Max"
                  onChange={e =>
                    formik.setFieldValue(
                      "millis.max",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />
              </FlexElement>
            ),
            dimensionY: "fill",
          }}
        />

        {/* Keys Examined */}
        <FluidContainer
          dimensionX="fill"
          dimensionY={25}
          prefix={{
            children: <Text>Keys Examined</Text>,
            dimensionX: "fill",
            alignment: "leftCenter",
          }}
          suffix={{
            children: (
              <FlexElement className={styles.content} dimensionY="fill" gap={10}>
                <Input
                  value={formik.values.keysExamined.min ?? ""}
                  type="number"
                  dimensionX={90}
                  placeholder="Min"
                  onChange={e =>
                    formik.setFieldValue(
                      "keysExamined.min",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />
                <div className={styles.separator} />
                <Input
                  value={formik.values.keysExamined.max ?? ""}
                  type="number"
                  dimensionX={90}
                  placeholder="Max"
                  onChange={e =>
                    formik.setFieldValue(
                      "keysExamined.max",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />
              </FlexElement>
            ),
            dimensionY: "fill",
          }}
        />

        {/* Docs Examined */}
        <FluidContainer
          dimensionX="fill"
          dimensionY={25}
          prefix={{
            children: <Text>Docs Examined</Text>,
            dimensionX: "fill",
            alignment: "leftCenter",
          }}
          suffix={{
            children: (
              <FlexElement className={styles.content} dimensionY="fill" gap={10}>
                <Input
                  value={formik.values.docsExamined.min ?? ""}
                  type="number"
                  dimensionX={90}
                  placeholder="Min"
                  onChange={e =>
                    formik.setFieldValue(
                      "docsExamined.min",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />
                <div className={styles.separator} />
                <Input
                  value={formik.values.docsExamined.max ?? ""}
                  type="number"
                  dimensionX={90}
                  placeholder="Max"
                  onChange={e =>
                    formik.setFieldValue(
                      "docsExamined.max",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />
              </FlexElement>
            ),
            dimensionY: "fill",
          }}
        />

        {/* Plan Summary */}
        <FluidContainer
          dimensionX="fill"
          dimensionY={25}
          prefix={{
            children: <Text>Plan Summary</Text>,
            dimensionX: "fill",
            dimensionY: "fill",
            alignment: "leftCenter",
          }}
          suffix={{
            children: (
              <Input
                value={formik.values.planSummary}
                placeholder="e.g. IXSCAN, COLLSCAN"
                dimensionX={200}
                onChange={e => formik.setFieldValue("planSummary", e.target.value)}
                className={styles.content}
              />
            ),
            dimensionY: "fill",
          }}
        />

        {/* Client */}
        <FluidContainer
          dimensionX="fill"
          dimensionY={25}
          prefix={{
            children: <Text>Client</Text>,
            dimensionX: "fill",
            dimensionY: "fill",
            alignment: "leftCenter",
          }}
          suffix={{
            children: (
              <Input
                value={formik.values.client}
                placeholder="Filter by client"
                dimensionX={200}
                onChange={e => formik.setFieldValue("client", e.target.value)}
                className={styles.content}
              />
            ),
            dimensionY: "fill",
          }}
        />

        {/* Timestamp */}
        <Text dimensionX="fill">Timestamp</Text>
        <FlexElement direction="wrap" dimensionX="fill">
          {PROFILER_TIMESTAMP_PRESETS.map(el => {
            const active = formik.values.ts.quickdate === el.value;
            return (
              <Chip
                gap={5}
                dimensionX={120}
                dimensionY={25}
                key={el.value}
                label={el.label}
                className={`${styles.chip} ${active ? styles.active : ""}`}
                variant="outlined"
                suffixIcon={active ? "check" : undefined}
                onClick={() => formik.setFieldValue("ts.quickdate", active ? null : el.value)}
              />
            );
          })}
        </FlexElement>

        <FluidContainer
          dimensionX="fill"
          prefix={{
            children: <Text>From</Text>,
            dimensionX: "fill",
            alignment: "leftCenter",
          }}
          suffix={{
            children: (
              <FlexElement className={styles.content} dimensionY={31.5} dimensionX={200}>
                <DatePicker
                  onChange={date => formik.setFieldValue("ts.from", date)}
                  value={formik.values.ts.from ?? null}
                  placeholder="Date"
                  suffixIcon={<Icon name="chevronDown" />}
                  format="YYYY-MM-DD HH:mm:ss"
                  showTime={true}
                />
              </FlexElement>
            ),
          }}
        />

        <FluidContainer
          dimensionX="fill"
          prefix={{
            children: <Text>To</Text>,
            dimensionX: "fill",
            alignment: "leftCenter",
          }}
          suffix={{
            children: (
              <FlexElement className={styles.content} dimensionY={31.5} dimensionX={200}>
                <DatePicker
                  onChange={date => formik.setFieldValue("ts.to", date)}
                  value={formik.values.ts.to ?? null}
                  placeholder="Date"
                  suffixIcon={<Icon name="chevronDown" />}
                  format="YYYY-MM-DD HH:mm:ss"
                  showTime={true}
                />
              </FlexElement>
            ),
          }}
        />

        {/* Actions */}
        <FlexElement dimensionX="fill" alignment="rightCenter">
          <Button variant="text" onClick={handleCancel} className={styles.button}>
            <Icon name="close" size="sm" />
            Cancel
          </Button>
          <Button type="submit">
            <Icon name="filter" size="sm" className={styles.button} /> Apply
          </Button>
        </FlexElement>
      </FlexElement>
    </form>
  );
};

export default memo(ProfilerFilter);
