import {type FC, memo} from "react";
import styles from "./StorageFilter.module.scss";
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
  type TypeFilterValue
} from "oziko-ui-kit";
import {useFormik} from "formik";

type TypeStorageFilter = {
  onApply?: (filter: TypeFilterValue) => void;
  onCancel?: () => void;
};

const types = [
  {value: "jpg", label: "JPG"},
  {value: "png", label: "PNG"},
  {value: "mp4", label: "MP4"}
];

const units = ["kb", "mb", "gb", "tb"];

const createdAtArr = [
  {value: "last_1_hour", label: "Last 1 Hour"},
  {value: "last_6_hour", label: "Last 6 Hour"},
  {value: "last_12_hour", label: "Last 12 Hour"},
  {value: "last_24_hour", label: "Last 24 Hour"},
  {value: "last_2_days", label: "Last 2 Days"},
  {value: "last_7_days", label: "Last 7 Days"},
  {value: "last_14_days", label: "Last 14 Days"},
  {value: "last_28_days", label: "Last 28 Days"},
  {value: "today", label: "Today"},
  {value: "yesterday", label: "Yesterday"},
  {value: "this_week", label: "This Week"},
  {value: "last_week", label: "Last Week"}
];

const StorageFilter: FC<TypeStorageFilter> = ({onApply, onCancel}) => {
  const formik = useFormik({
    initialValues: {
      type: ["jpg", "png", "mp4"],
      fileSize: {
        min: {
          value: 1,
          unit: "mb"
        },
        max: {
          value: 10,
          unit: "gb"
        }
      },
      quickdate: null,
      dateRange: {
        from: null,
        to: null
      }
    },
    onSubmit: values => onSubmit(values)
  });

  const onSubmit = (data: TypeFilterValue) => {
    onApply?.(data);
  };

  const handleCancel = () => {
    onCancel?.();
  };

  return (
    <form onSubmit={formik.handleSubmit}>
      <FlexElement
        dimensionX={515}
        dimensionY={350}
        gap={10}
        className={styles.container}
        direction="vertical"
      >
        <FluidContainer
          dimensionX="fill"
          prefix={{
            children: <Text>Type</Text>,
            dimensionX: "fill",
            alignment: "leftCenter"
          }}
          suffix={{
            children: (
              <Select
                dimensionY="hug"
                options={types}
                value={formik.values.type}
                onChange={v => formik.setFieldValue("type", v)}
                dimensionX={200}
                alignment="rightCenter"
                placeholder=""
                multiple
                className={`${styles.select} ${styles.content}`}
              />
            )
          }}
        />
        <FluidContainer
          dimensionX="fill"
          prefix={{
            children: <Text>File Size</Text>,
            dimensionX: "fill",
            alignment: "leftCenter"
          }}
          suffix={{
            children: (
              <FlexElement className={styles.content}>
                <FlexElement className={styles.left}>
                  <Input
                    value={formik.values.fileSize.min.value}
                    type="number"
                    dimensionX={45}
                    onChange={e => formik.setFieldValue("fileSize.min.value", e.target.value)}
                  />
                  <Select
                    dimensionY="hug"
                    options={units}
                    dimensionX={60}
                    onChange={v => formik.setFieldValue("fileSize.min.unit", v)}
                    alignment="rightCenter"
                    placeholder=""
                    value={formik.values.fileSize.min.unit}
                    className={styles.select}
                  />
                </FlexElement>
                <FlexElement>
                  <Input
                    value={formik.values.fileSize.max.value}
                    type="number"
                    dimensionX={45}
                    onChange={e => formik.setFieldValue("fileSize.max.value", e.target.value)}
                  />
                  <Select
                    dimensionY="hug"
                    options={units}
                    dimensionX={60}
                    onChange={v => formik.setFieldValue("fileSize.max.unit", v)}
                    alignment="rightCenter"
                    placeholder=""
                    value={formik.values.fileSize.max.unit}
                    className={styles.select}
                  />
                </FlexElement>
              </FlexElement>
            )
          }}
        />
        <Text dimensionX="fill">Created At</Text>

        <FlexElement direction="wrap" dimensionX="fill">
          {createdAtArr.map(el => {
            const active = formik.values.quickdate === el.value;
            return (
              <Chip
                gap={5}
                dimensionX={120}
                key={el.value}
                label={el.label}
                className={`${styles.chip} ${active && styles.active}`}
                variant="outlined"
                suffixIcon={active ? "check" : undefined}
                onClick={() => formik.setFieldValue("quickdate", el.value)}
              />
            );
          })}
        </FlexElement>

        <FluidContainer
          dimensionX="fill"
          prefix={{
            children: <Text>From</Text>,
            dimensionX: "fill",
            alignment: "leftCenter"
          }}
          suffix={{
            children: (
              <FlexElement className={styles.content} dimensionY={31.5} dimensionX={200}>
                <DatePicker
                  onChange={date => formik.setFieldValue("dateRange.from", date)}
                  value={formik.values.dateRange.from || null}
                  placeholder="Date"
                  suffixIcon={<Icon name="chevronDown" />}
                  format="YYYY-MM-DD HH:mm:ss"
                  showTime={true}
                />
              </FlexElement>
            )
          }}
        />
        <FluidContainer
          dimensionX="fill"
          prefix={{
            children: <Text>To</Text>,
            dimensionX: "fill",
            alignment: "leftCenter"
          }}
          suffix={{
            children: (
              <FlexElement className={styles.content} dimensionY={31.5} dimensionX={200}>
                <DatePicker
                  onChange={date => formik.setFieldValue("dateRange.to", date)}
                  value={formik.values.dateRange.to}
                  placeholder="Date"
                  suffixIcon={<Icon name="chevronDown" />}
                  format="YYYY-MM-DD HH:mm:ss"
                  showTime={true}
                />
              </FlexElement>
            )
          }}
        />
        <FlexElement dimensionX="fill" alignment="rightCenter">
          <Button variant="text" onClick={handleCancel} className={styles.button}>
            <Icon name="close" size="sm"/>
            Cancel
          </Button>
          <Button type="submit">
            <Icon name="filter" size="sm" className={styles.button}/> Apply
          </Button>
        </FlexElement>
      </FlexElement>
    </form>
  );
};

export default memo(StorageFilter);
