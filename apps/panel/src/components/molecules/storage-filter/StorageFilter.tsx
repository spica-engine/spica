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
import {
  STORAGE_TYPE_OPTIONS,
  STORAGE_SIZE_UNITS,
  STORAGE_CREATED_AT_PRESETS,
  createStorageFilterDefaultValues
} from "../../../utils/storageFilter";

type TypeStorageFilter = {
  onApply?: (filter: TypeFilterValue) => void;
  onCancel?: () => void;
  initialValues?: TypeFilterValue;
};

const StorageFilter: FC<TypeStorageFilter> = ({onApply, onCancel, initialValues}) => {
  const formik = useFormik({
    initialValues: initialValues ?? createStorageFilterDefaultValues(),
    enableReinitialize: true,
    onSubmit: values => onSubmit(values)
  });

  const onSubmit = (data: TypeFilterValue) => {
    onApply?.(data);
  };

  const handleCancel = () => {
    formik.resetForm();
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
                options={STORAGE_TYPE_OPTIONS}
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
                    value={formik.values.fileSize.min.value ?? ""}
                    type="number"
                    dimensionX={45}
                    onChange={e =>
                      formik.setFieldValue(
                        "fileSize.min.value",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                  />
                  <Select
                    dimensionY="hug"
                    options={STORAGE_SIZE_UNITS}
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
                    value={formik.values.fileSize.max.value ?? ""}
                    type="number"
                    dimensionX={45}
                    onChange={e =>
                      formik.setFieldValue(
                        "fileSize.max.value",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                  />
                  <Select
                    dimensionY="hug"
                    options={STORAGE_SIZE_UNITS}
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
          {STORAGE_CREATED_AT_PRESETS.map(el => {
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
