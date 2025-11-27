/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {Table, Icon, type IconName, FlexElement} from "oziko-ui-kit";
import React, {useCallback, useMemo} from "react";
import {useParams} from "react-router-dom";
import BucketFieldPopup from "../../../molecules/bucket-field-popup/BucketFieldPopup";
import {useBucketColumns} from "../../../../hooks/useBucketColumns";
import {useBucketSearch} from "../../../../hooks/useBucketSearch";
import {useBucketData} from "../../../../hooks/useBucketData";
import {useCreateBucketFieldMutation, useGetBucketQuery} from "../../../../store/api/bucketApi";
import {FieldKind, FIELD_REGISTRY} from "../../../../domain/fields";
import type {ColumnType} from "../../bucket-table/BucketTable";
import styles from "./BucketTableNew.module.scss";
import type {FieldFormState} from "../../../../domain/fields/types";
import type {BucketType} from "../../../../services/bucketService";

const COLUMN_ICONS: Record<string, IconName> = Object.values(FieldKind).reduce(
  (acc, k) => {
    const def = FIELD_REGISTRY[k];
    if (def) acc[k] = def.display.icon;
    return acc;
  },
  {} as Record<string, IconName>
);

const BucketTableNew = () => {
  const {bucketId = ""} = useParams<{bucketId: string}>();

  const {data: bucket, isLoading} = useGetBucketQuery(bucketId, {
    skip: !bucketId
  });


  const {formattedColumns, searchableColumns} = useBucketColumns(bucket, bucketId);

  const {searchQuery} = useBucketSearch(bucketId, searchableColumns);

  const {bucketData} = useBucketData(bucketId, searchQuery);
  const [createBucketField] = useCreateBucketFieldMutation();

  // Store cell action handlers (Enter/Escape per cell)
  const cellActionsRef = React.useRef<{
    [key: string]: {
      onEnter?: () => void;
      onEscape?: () => void;
    };
  }>({});

  const columnsWithHeaders = useMemo(() => {
    const mappedColumns = formattedColumns.map((column: ColumnType) => {
      const icon = column.type ? COLUMN_ICONS[column.type] : undefined;

      return {
        ...column,
        header: (
          <>
            {icon && <Icon name={icon} size={16} />}
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {column.header}
            </span>
            {/* add popover here */}
          </>
        )
      };
    });

    return [...mappedColumns];
  }, [formattedColumns]);

  const forbiddenFieldNames = useMemo(() => {
    return bucket?.properties ? Object.keys(bucket.properties) : [];
  }, [bucket]);

  const handleSaveAndClose = useCallback(
    async (values: FieldFormState, kind: FieldKind): Promise<BucketType> => {
      if (!bucket) {
        throw new Error("No bucket available");
      }

      const fieldProperty = FIELD_REGISTRY[kind]?.buildCreationFormApiProperty(values);
      const {requiredField, primaryField} = values.configurationValues;
      const {title} = values.fieldValues;


      const modifiedBucket = {
        ...bucket,
        properties: {
          ...bucket.properties,
          [title]: fieldProperty
        },
        required: requiredField ? [...(bucket.required || []), title] : bucket.required,
        primary: primaryField ? title : bucket.primary
      };

      const result = await createBucketField(modifiedBucket);
      if (!result.data) {
        throw new Error("Failed to create bucket field");
      }
      return result.data;
    },
    [bucket, createBucketField]
  );

  const handleCellEnter = useCallback((columnKey: string, rowIndex: number, event: KeyboardEvent) => {
    const cellKey = `${columnKey}-${rowIndex}`;
    const actions = cellActionsRef.current[cellKey];

    if (actions?.onEnter) {
      actions.onEnter();
    }
  }, []);

  // Handle Escape key press on a cell
  const handleCellEscape = useCallback((columnKey: string, rowIndex: number, event: KeyboardEvent) => {
    const cellKey = `${columnKey}-${rowIndex}`;
    const actions = cellActionsRef.current[cellKey];

    if (actions?.onEscape) {
      actions.onEscape();
    }
  }, []);

  if (isLoading || !bucket) {
    return <div>Loading...</div>;
  }

  return (
    <FlexElement className={styles.tableContainer} dimensionX={"fill"} dimensionY={"fill"} gap={0}>
      <Table
        columns={columnsWithHeaders}
        data={bucketData?.data ?? []}
        noResizeableColumns={["_id"]}
        fixedColumns={["_id"]}
        tableClassName={styles.table}
        headerClassName={styles.header}
        columnClassName={styles.column}
        cellClassName={styles.cell}
        onCellEnter={handleCellEnter}
        onCellEscape={handleCellEscape}
        saveToLocalStorage={{
          id: `bucket-table-${bucketId}`,
          save: true
        }}
      />

      <FlexElement
        className={styles.newFieldContainer}
        direction="vertical"
        dimensionY="fill"
        alignment="leftTop"
      >
        <BucketFieldPopup
          onSaveAndClose={handleSaveAndClose}
          forbiddenFieldNames={forbiddenFieldNames}
        >
          {({onOpen}) => (
            <FlexElement className={styles.newFieldHeader} dimensionY={36} onClick={onOpen}>
              <Icon name="plus" size={16} />
              <span>New Field</span>
            </FlexElement>
          )}
        </BucketFieldPopup>
      </FlexElement>
    </FlexElement>
  );
};

export default BucketTableNew;