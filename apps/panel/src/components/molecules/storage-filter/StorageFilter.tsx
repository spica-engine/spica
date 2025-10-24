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
  currentFilter?: TypeFilterValue;
};

const types = [
  {value: "image/jpeg", label: "JPEG/JPG"},
  {value: "image/png", label: "PNG"},
  {value: "image/gif", label: "GIF"},
  {value: "image/svg+xml", label: "SVG"},
  {value: "image/bmp", label: "BMP"},
  {value: "image/webp", label: "WEBP"},
  {value: "image/tiff", label: "TIFF"},
  {value: "image/heic", label: "HEIC"},
  {value: "video/mp4", label: "MP4"},
  {value: "video/quicktime", label: "MOV"},
  {value: "video/x-msvideo", label: "AVI"},
  {value: "video/x-matroska", label: "MKV"},
  {value: "video/webm", label: "WEBM"},
  {value: "audio/mpeg", label: "MP3"},
  {value: "audio/wav", label: "WAV"},
  {value: "audio/flac", label: "FLAC"},
  {value: "application/pdf", label: "PDF"},
  {value: "application/msword", label: "DOC"},
  {value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "DOCX"},
  {value: "application/vnd.ms-excel", label: "XLS"},
  {value: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "XLSX"},
  {value: "application/vnd.ms-powerpoint", label: "PPT"},
  {value: "application/vnd.openxmlformats-officedocument.presentationml.presentation", label: "PPTX"},
  {value: "text/plain", label: "TXT"},
  {value: "text/csv", label: "CSV"},
  {value: "text/html", label: "HTML"},
  {value: "text/javascript", label: "JavaScript"},
  {value: "application/zip", label: "ZIP"},
  {value: "application/x-rar-compressed", label: "RAR"},
  {value: "application/x-7z-compressed", label: "7Z"},
  {value: "application/x-tar", label: "TAR"},
  {value: "application/gzip", label: "GZ"},
  {value: "application/octet-stream", label: "Binary/Other"}
];

const units = ["kb", "mb", "gb", "tb"];

export const createdAtArr = [
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

const StorageFilter: FC<TypeStorageFilter> = ({onApply, onCancel, currentFilter}) => {
  const formik = useFormik({
    initialValues: {
      type: currentFilter?.type || ["image/jpeg", "image/png", "video/mp4"],
      fileSize: currentFilter?.fileSize || {
        min: {
          value: 1,
          unit: "mb"
        },
        max: {
          value: 10,
          unit: "gb"
        }
      },
      quickdate: currentFilter?.quickdate || null,
      dateRange: currentFilter?.dateRange || {
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
                    value={formik.values.fileSize.min.value || undefined}
                    type="number"
                    dimensionX={45}
                    onChange={e => formik.setFieldValue("fileSize.min.value", e.target.value)}
                  />
                  <Select
                    dimensionY="hug"
                    options={units}
                    dimensionX={80}
                    onChange={v => formik.setFieldValue("fileSize.min.unit", v)}
                    alignment="rightCenter"
                    placeholder=""
                    value={formik.values.fileSize.min.unit}
                    className={styles.select}
                  />
                </FlexElement>
                <FlexElement>
                  <Input
                    value={formik.values.fileSize.max.value || undefined}
                    type="number"
                    dimensionX={45}
                    onChange={e => formik.setFieldValue("fileSize.max.value", e.target.value)}
                  />
                  <Select
                    dimensionY="hug"
                    options={units}
                    dimensionX={80}
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

export default memo(StorageFilter);
