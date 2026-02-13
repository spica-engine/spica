/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {useCallback, useMemo, memo} from "react";
import {useFormik, type FormikProps} from "formik";
import {
  Button,
  FlexElement,
  Icon,
  Select,
  StringInput,
  Text,
  DatePicker,
  Popover
} from "oziko-ui-kit";
import type {ActivityOptions} from "../../store/api";
import {buildActivityFilterOptions} from "../../store/api/activitiesApi";
import {useGetBucketsQuery, useGetBucketDataQuery} from "../../store/api/bucketApi";
import {ACTION_TYPE_OPTIONS} from "./activityUtils";
import styles from "./ActivityFilterPopover.module.scss";

const MODULE_OPTIONS = [
  {value: "bucket", label: "Bucket"},
  {value: "storage", label: "Storage"},
  {value: "passport", label: "Passport"},
  {value: "function", label: "Function"},
  {value: "preference", label: "Preference"}
];

export interface ActivityFilterFormValues {
  identifier: string;
  actionTypes: number[];
  module: string | null;
  bucketId: string | null;
  documentIds: string[];
  dateRange: {from: Date | null; to: Date | null};
}

function normalizeMultiSelectValue(v: unknown): string[] {
  if (Array.isArray(v))
    return v
      .filter((x): x is string | number => typeof x === "string" || typeof x === "number")
      .map(String);
  if (typeof v === "string" || typeof v === "number") return [String(v)];
  return [];
}

function normalizeActionTypes(v: unknown): number[] {
  const arr = normalizeMultiSelectValue(v).map(Number);
  return arr.filter(n => !Number.isNaN(n) && n > 0);
}

const initialFormValues: ActivityFilterFormValues = {
  identifier: "",
  actionTypes: [],
  module: null,
  bucketId: null,
  documentIds: [],
  dateRange: {from: null, to: null}
};

interface ActivityFilterFormProps {
  formik: FormikProps<ActivityFilterFormValues>;
  bucketOptions: {value: string; label: string}[];
  documentIdOptions: {value: string; label: string}[];
  documentIdPlaceholder: string;
  isBucketModule: boolean;
  onCancel: () => void;
}

const ActivityFilterForm = memo(function ActivityFilterForm({
  formik,
  bucketOptions,
  documentIdOptions,
  documentIdPlaceholder,
  isBucketModule,
  onCancel
}: ActivityFilterFormProps) {
  return (
    <form onSubmit={formik.handleSubmit}>
      <FlexElement dimensionX={400} gap={10} className={styles.container} direction="vertical" alignment="leftTop">
        <StringInput
          label="Identifier"
          value={formik.values.identifier}
          onChange={v => formik.setFieldValue("identifier", v)}
          dimensionX="fill"
        />
        <Select
          options={ACTION_TYPE_OPTIONS}
          value={formik.values.actionTypes}
          onChange={v => formik.setFieldValue("actionTypes", normalizeActionTypes(v))}
          multiple
          placeholder="Select action types"
          dimensionX="fill"
        />
        <FlexElement direction="horizontal" gap={4} dimensionX="fill">
          <Select
            options={MODULE_OPTIONS}
            value={formik.values.module ?? undefined}
            onChange={v => {
              formik.setFieldValue("module", v);
              formik.setFieldValue("bucketId", null);
              formik.setFieldValue("documentIds", []);
            }}
            placeholder="Select module"
            dimensionX="fill"
          />
          <Select
            options={documentIdOptions}
            value={formik.values.documentIds}
            onChange={v => formik.setFieldValue("documentIds", normalizeMultiSelectValue(v))}
            multiple
            placeholder={documentIdPlaceholder}
            dimensionX="fill"
            disabled={Boolean(isBucketModule && !formik.values.bucketId)}
          />
        </FlexElement>
        {isBucketModule ? (
          <FlexElement direction="vertical" gap={4}>
            <Text dimensionX="fill">Bucket</Text>
            <Select
              options={bucketOptions}
              value={formik.values.bucketId ?? undefined}
              onChange={v => {
                formik.setFieldValue("bucketId", v);
                formik.setFieldValue("documentIds", []);
              }}
              placeholder="Select bucket"
              dimensionX="fill"
            />
          </FlexElement>
        ) : null}
        <FlexElement gap={8} dimensionX="fill">
          <DatePicker
            value={formik.values.dateRange.from}
            onChange={d => formik.setFieldValue("dateRange.from", d)}
            placeholder="Start date"
            format="YYYY-MM-DD HH:mm:ss"
            showTime
            suffixIcon={<Icon name="chevronDown" />}
          />
          <DatePicker
            value={formik.values.dateRange.to}
            onChange={d => formik.setFieldValue("dateRange.to", d)}
            placeholder="End date"
            format="YYYY-MM-DD HH:mm:ss"
            showTime
            suffixIcon={<Icon name="chevronDown" />}
          />
        </FlexElement>
        <FlexElement dimensionX="fill" alignment="rightCenter" gap={8}>
          <Button variant="text" onClick={onCancel} type="button">
            <Icon name="close" size="sm" />
            Cancel
          </Button>
          <Button type="submit">
            <Icon name="filter" size="sm" />
            Apply
          </Button>
        </FlexElement>
      </FlexElement>
    </form>
  );
});

export interface ActivityFilterPopoverProps {
  open: boolean;
  onClose: () => void;
  onApply: (options: ActivityOptions) => void;
  initialValues?: Partial<ActivityFilterFormValues>;
  children: React.ReactNode;
}

const ActivityFilterPopover: React.FC<ActivityFilterPopoverProps> = ({
  open,
  onClose,
  onApply,
  initialValues,
  children
}) => {
  const {data: buckets = []} = useGetBucketsQuery({});
  const bucketOptions = useMemo(
    () => buckets.map(b => ({value: b._id, label: b.title || b._id})),
    [buckets]
  );

  const formik = useFormik<ActivityFilterFormValues>({
    initialValues: {...initialFormValues, ...initialValues},
    enableReinitialize: true,
    onSubmit: values => {
      onApply(buildActivityFilterOptions(values));
      onClose();
    }
  });

  const selectedBucketId = formik.values.bucketId;
  const shouldFetchBucketData = Boolean(selectedBucketId && formik.values.module === "bucket");
  const {data: bucketData} = useGetBucketDataQuery(
    {bucketId: selectedBucketId ?? "", limit: 100},
    {skip: !shouldFetchBucketData}
  );

  const documentIdOptions = useMemo(() => {
    if (!bucketData?.data) return [];
    return bucketData.data.map((row: {_id?: string}) => ({
      value: String(row._id ?? ""),
      label: String(row._id ?? "")
    }));
  }, [bucketData]);

  const handleCancel = useCallback(() => {
    formik.resetForm({values: {...initialFormValues, ...initialValues}});
    onClose();
  }, [formik, initialValues, onClose]);

  const isBucketModule = formik.values.module === "bucket";

  const documentIdPlaceholder =
    isBucketModule && !selectedBucketId ? "Select a bucket first" : "Select documents";

  return (
    <Popover
      open={open}
      onClose={onClose}
      placement="bottom"
      content={
        <ActivityFilterForm
          formik={formik}
          bucketOptions={bucketOptions}
          documentIdOptions={documentIdOptions}
          documentIdPlaceholder={documentIdPlaceholder}
          isBucketModule={isBucketModule}
          onCancel={handleCancel}
        />
      }
      contentProps={{
        className: styles.popoverContainer,
      }}
    >
      {children}
    </Popover>
  );
};

export default ActivityFilterPopover;
