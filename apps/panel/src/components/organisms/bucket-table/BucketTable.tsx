import {Button, Checkbox, Icon, Popover, useAdaptivePosition, type IconName} from "oziko-ui-kit";
import Table, {type TypeDataColumn} from "../table/Table";
import styles from "./BucketTable.module.scss";
import {memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject} from "react";
import Loader from "../../../components/atoms/loader/Loader";
import BucketFieldPopup from "../../molecules/bucket-field-popup/BucketFieldPopup";
import {useBucket} from "../../../contexts/BucketContext";
import {FieldKind, FIELD_REGISTRY} from "../../../domain/fields";
import {BucketFieldPopupsProvider} from "../../molecules/bucket-field-popup/BucketFieldPopupsContext";
import ColumnActionsMenu from "../../molecules/column-actions-menu/ColumnActionsMenu";
import type {FieldFormState} from "../../../domain/fields/types";
import type {Property} from "src/services/bucketService";
import BucketFieldConfigurationPopup from "../../../components/molecules/bucket-field-popup/BucketFieldConfigurationPopup";

export type ColumnType = Partial<Property> & {
  id: string;
  header: any;
  key: string;
  type?: FieldKind;
  width?: string;
  deletable?: boolean;
  headerClassName?: string;
  cellClassName?: string;
  showDropdownIcon?: boolean;
  resizable?: boolean;
  fixed?: boolean;
  selectable?: boolean;
  leftOffset?: number;
  fixedWidth?: boolean;
};

type BucketTableProps = {
  data: Record<string, any>[];
  columns: ColumnType[];
  onScrollEnd?: () => void;
  totalDataLength: number;
  maxHeight?: string | number;
  bucketId: string;
  loading: boolean;
  tableRef?: RefObject<HTMLElement | null>;
};

type ColumnHeaderProps = {
  title?: string;
  icon?: IconName;
  showDropdownIcon?: boolean;
  onEdit?: () => void;
  onMoveRight?: () => void;
  onMoveLeft?: () => void;
  onSortAsc?: () => void;
  onSortDesc?: () => void;
  onDelete?: () => void;
  type?: FieldKind | null;
  property?: Property;
};

type ColumnMeta = {
  type?: FieldKind;
  deletable?: boolean;
  id: string;
};

const COLUMN_ICONS: Record<string, IconName> = Object.values(FieldKind).reduce(
  (acc, k) => {
    const def = FIELD_REGISTRY[k as FieldKind];
    if (def) acc[k] = def.display.icon as IconName;
    return acc;
  },
  {} as Record<string, IconName>
);

const ColumnHeader = ({
  title,
  icon,
  showDropdownIcon,
  onMoveRight,
  onMoveLeft,
  onSortAsc,
  onSortDesc,
  onDelete,
  type,
  property
}: ColumnHeaderProps) => {
  const [isFieldEditPopupOpen, setIsFieldEditPopupOpen] = useState(false);
  const {buckets, bucketData, updateBucketField} = useBucket();

  const bucket = useMemo(
    () => buckets.find(i => i._id === bucketData?.bucketId),
    [buckets, bucketData?.bucketId]
  );

  const handleSaveAndClose = useCallback(
    (values: FieldFormState) => {
      if (!bucket) return;
      console.log("Updating field with values:", {values, property, bucket});

      if (bucket.primary === property?.key && !values.configurationValues.primaryField) {
        // Trying to unset primary field
        // The validation should be handled from the popup, this is just a temporary safeguard
        // We gonna remove this later
        alert("You must set another field as primary before unsetting this field.");
        return;
      }

      const fieldProperty = FIELD_REGISTRY[type as FieldKind]?.buildCreationFormApiProperty(values);
      const {requiredField, primaryField} = values.configurationValues;
      if (fieldProperty) {
        fieldProperty.key = property?.key || property?.title;
      }
      return updateBucketField(bucket, fieldProperty as Property, requiredField, primaryField);
    },
    [bucket, updateBucketField]
  );

  const forbiddenFieldNames = useMemo(() => {
    if (!bucket) return [];
    return Object.values(bucket.properties || {}).map(i => i.title).filter(k => k !== property?.title);
  }, [bucket]);

  const onEdit = useCallback(() => {
    setIsFieldEditPopupOpen(true);
  }, []);

  const fieldEditPopoverRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const {targetPosition, calculatePosition} = useAdaptivePosition({
    containerRef,
    targetRef: fieldEditPopoverRef,
    initialPlacement: "leftStart"
  });

  useEffect(calculatePosition, [
    calculatePosition,
    fieldEditPopoverRef.current,
    isFieldEditPopupOpen
  ]);

  const field = FIELD_REGISTRY[type!];
  const defaultFormValues = field?.creationFormDefaultValues!;

  const formValues = {
    ...defaultFormValues,
    type,
    fieldValues: {
      ...defaultFormValues?.fieldValues,
      title: property?.title,
      description: property?.description ?? defaultFormValues?.fieldValues?.description,
      maximum: property?.maximum ?? defaultFormValues?.fieldValues?.maximum,
      minimum: property?.minimum ?? defaultFormValues?.fieldValues?.minimum,
    },
    configurationValues: {
      ...defaultFormValues?.configurationValues,
      requiredField: bucket?.required?.includes(property?.key),
      uniqueValues: property?.options?.unique || false,
      primaryField: bucket?.primary === property?.key,
      index: property?.options?.index || false,
      translate: property?.options?.translate || false
    },
    presetValues: defaultFormValues?.presetValues
      ? {
          ...defaultFormValues?.presetValues,
          makeEnumerated: type === FieldKind.Multiselect ? true : undefined,
          definePattern: property?.items?.pattern ? true : undefined,
          enumeratedValues: property?.items?.enum,
          pattern: property?.items?.pattern
        }
      : undefined,
    multipleSelectionTab: defaultFormValues?.multipleSelectionTab
      ? {
          ...defaultFormValues?.multipleSelectionTab,
          multipleSelectionType: property?.items.type,
          maxItems: property?.maxItems
        }
      : undefined,
    defaultValue: property?.default
  };

  return (
    <>
      <div className={styles.columnHeaderText}>
        {icon && <Icon name={icon} size="sm" className={styles.headerIcon} />}
        <span>{title || "\u00A0"}</span>
      </div>
      {showDropdownIcon && (
        <>
          <Popover
            portalClassName={isFieldEditPopupOpen ? styles.noOpacity : undefined}
            content={
              <ColumnActionsMenu
                onEdit={onEdit}
                onMoveRight={onMoveRight}
                onMoveLeft={onMoveLeft}
                onSortAsc={onSortAsc}
                onSortDesc={onSortDesc}
                onDelete={onDelete}
              />
            }
            contentProps={{
              ref: containerRef,
              className: styles.popover
            }}
            placement="topStart"
          >
            <Button variant="icon">
              <Icon name="chevronDown" size="lg" />
            </Button>
          </Popover>
          <BucketFieldPopupsProvider>
            <BucketFieldConfigurationPopup
              isOpen={isFieldEditPopupOpen}
              selectedType={type ?? null}
              onClose={() => setIsFieldEditPopupOpen(false)}
              onSaveAndClose={handleSaveAndClose}
              popupType="edit-field"
              forbiddenFieldNames={forbiddenFieldNames}
              popoverClassName={styles.fieldConfigPopover}
              popoverContentStyles={targetPosition ?? undefined}
              externalBucketAddFieldRef={fieldEditPopoverRef as React.RefObject<HTMLDivElement>}
              initialValues={formValues as FieldFormState}
            >
              <div />
            </BucketFieldConfigurationPopup>
          </BucketFieldPopupsProvider>
        </>
      )}
    </>
  );
};

const NewFieldHeader = memo(() => {
  const {buckets, bucketData, createBucketField} = useBucket();

  const bucket = useMemo(
    () => buckets.find(i => i._id === bucketData?.bucketId),
    [buckets, bucketData?.bucketId]
  );

  const handleSaveAndClose = useCallback(
    (values: FieldFormState, kind: FieldKind) => {
      if (!bucket) return;

      const fieldProperty = FIELD_REGISTRY[kind]?.buildCreationFormApiProperty(values);
      const {requiredField, primaryField} = values.configurationValues;
      const {title} = values.fieldValues;

      //console.log("Creating field with values:", {values, kind, fieldProperty});
      return createBucketField(
        bucket,
        fieldProperty as Property,
        requiredField ? title : undefined,
        primaryField ? title : undefined
      );
    },
    [bucket, createBucketField]
  );

  const forbiddenFieldNames = useMemo(() => {
    if (!bucket) return [];
    return Object.keys(bucket.properties || {});
  }, [bucket]);

  return (
    <BucketFieldPopupsProvider>
      <BucketFieldPopup
        onSaveAndClose={handleSaveAndClose}
        forbiddenFieldNames={forbiddenFieldNames}
      >
        <Button
          variant="icon"
          className={`${styles.columnHeaderText} ${styles.newFieldColumnButton}`}
        >
          <Icon name={"plus"} size="sm" className={styles.newFieldHeaderIcon} />
          <span>New&nbsp;Field</span>
        </Button>
      </BucketFieldPopup>
    </BucketFieldPopupsProvider>
  );
});


// DELETE THIS COMPONENT WHILE MERGING TO THE PANEL, AS A COMPONENT ALREADY EXISTS IN THE PANEL
// FOR THE SELECT HEADERS, WE NEEDED IT HERE FOR THE TIME BEING TO AVOID ERRORS
const SelectHeader = () => (
  <div className={styles.selectHeader}>
    <Checkbox className={styles.headerCheckbox} />
  </div>
);

const defaultColumns: ColumnType[] = [
  {
    id: "0",
    header: <SelectHeader />,
    key: "select",
    type: FieldKind.Boolean as any,
    width: "41px",
    fixedWidth: true,
    headerClassName: styles.columnHeader,
    cellClassName: `${styles.selectCell} ${styles.cell}`,
    resizable: false,
    fixed: true,
    selectable: false
  },
  {
    id: "1",
    header: <NewFieldHeader />,
    key: "new field",
    width: "125px",
    headerClassName: `${styles.columnHeader} ${styles.newFieldHeader}`,
    cellClassName: `${styles.newFieldCell} ${styles.cell}`,
    resizable: false,
    fixed: true,
    selectable: false
  }
];

// TODO: Refactor this function to render more appropriate UI elements for each field type.
// Many field types are currently using the generic `renderDefault()`.
function renderCell(cellData: any, type?: FieldKind, deletable?: boolean) {
  function renderDefault() {
    return (
      <div className={styles.defaultCell}>
        <div className={styles.defaultCellData}>{cellData}</div>
        {deletable && cellData && (
          <Button variant="icon">
            <Icon name="close" size="sm" />
          </Button>
        )}
      </div>
    );
  }
  if (type === FieldKind.Boolean) return <Checkbox className={styles.checkbox} />;
  if (type) {
    const formatted = FIELD_REGISTRY[type]?.getFormattedValue?.(cellData);
    if (typeof formatted === "string" || typeof formatted === "number") return formatted as any;
  }
  return renderDefault();
}

function getFormattedColumns(columns: ColumnType[], bucketId: string): ColumnType[] {
  return [
    defaultColumns[0],
    ...columns.map((col, index) => ({
      ...col,
      header: (
        <ColumnHeader
          title={col.header}
          icon={col.type && COLUMN_ICONS[col.type]}
          showDropdownIcon={col.showDropdownIcon}
          type={col.type}
          property={col as Property}
        />
      ),
      headerClassName: `${col.headerClassName || ""} ${styles.columnHeader}`,
      id: `${col.key}-${index}-s${bucketId}`,
      cellClassName: styles.cell
    })),
    defaultColumns[1]
  ];
}

function buildColumnMeta(columns: ColumnType[]): Record<string, ColumnMeta> {
  return Object.fromEntries(
    columns.map(col => [col.key, {type: col.type, deletable: col.deletable, id: col.id}])
  );
}
function formatDataRows(data: any[], columnMap: Record<string, ColumnMeta>) {
  const allKeys = Object.keys(columnMap);

  return data.map(row => {
    const fullRow: Record<string, any> = {
      select: "",
      "new field": ""
    };

    allKeys.forEach(key => {
      if (!(key in fullRow)) {
        fullRow[key] = row[key];
      }
    });

    return Object.fromEntries(
      Object.entries(fullRow).map(([key, value]) => {
        const meta = columnMap[key] || {};
        return [
          key,
          {id: `${meta.id}-${fullRow._id}`, value: renderCell(value, meta.type, meta.deletable)}
        ];
      })
    );
  });
}

const BucketTable = ({
  data,
  columns,
  onScrollEnd,
  totalDataLength,
  maxHeight,
  loading,
  bucketId,
  tableRef
}: BucketTableProps) => {
  const formattedColumns = useMemo(
    () => getFormattedColumns(columns, bucketId),
    [columns, bucketId]
  );
  const columnMap = useMemo(() => buildColumnMeta(formattedColumns), [formattedColumns]);
  const formattedData = useMemo(
    () => formatDataRows(data, columnMap),
    [data, columnMap, columnMap.length]
  );

  return loading ? (
    <Loader />
  ) : (
    <Table
      style={{maxHeight}}
      className={styles.table}
      columns={formattedColumns}
      data={formattedData}
      onScrollEnd={onScrollEnd}
      totalDataLength={totalDataLength}
      tableRef={tableRef}
    />
  );
};

export default memo(BucketTable);
