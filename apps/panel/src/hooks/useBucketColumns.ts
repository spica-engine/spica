import {useMemo, useEffect} from "react";
import type {BucketType} from "../services/bucketService";
import type {ColumnType} from "../components/organisms/bucket-table/BucketTable";
import useLocalStorage from "./useLocalStorage";

interface UseBucketColumnsResult {
  formattedColumns: ColumnType[];
  filteredColumns: ColumnType[];
  visibleColumns: {[key: string]: boolean};
  searchableColumns: string[];
  toggleColumn: (key?: string) => void;
}

export function useBucketColumns(
  bucket: BucketType | undefined,
  bucketId: string
): UseBucketColumnsResult {
  const [fieldsOrder] = useLocalStorage<string[]>(`${bucketId}-fields-order`, []);

  const formattedColumns: ColumnType[] = useMemo(() => {
    const columns = Object.values(bucket?.properties ?? {});

    const orderedColumns = fieldsOrder.length
      ? (fieldsOrder
          .map(orderKey => columns.find(c => c.title === orderKey))
          .filter(Boolean) as ColumnType[] as typeof columns)
      : columns;

    return [
      {
        header: "_id",
        key: "_id",
        showDropdownIcon: true,
        sticky: true,
        width: "230px",
        resizable: false,
        fixed: true,
        selectable: false
      },
      ...orderedColumns.map(i => ({
        ...i,
        header: i.title,
        key: i.title,
        showDropdownIcon: true
      }))
    ] as ColumnType[];
  }, [bucket, fieldsOrder]);

  const searchableColumns = useMemo(
    () =>
      formattedColumns
        .filter(({type}) => ["string", "textarea", "richtext"].includes(type as string))
        .map(({key}) => key),
    [formattedColumns]
  );

  const defaultVisibleColumns = useMemo(
    () => Object.fromEntries(formattedColumns.map(col => [col.key, true])),
    [formattedColumns]
  );

  const visibleColumnsStorageKey = `${bucketId}-visible-columns`;
  const [visibleColumns, setVisibleColumns] = useLocalStorage<{[key: string]: boolean}>(
    visibleColumnsStorageKey,
    defaultVisibleColumns
  );

  const filteredColumns = useMemo(
    () => formattedColumns.filter(column => visibleColumns?.[column.key]),
    [formattedColumns, visibleColumns]
  );

  useEffect(() => {
    if (!bucketId || !formattedColumns.length) return;

    const currentVisibleKeys = Object.keys(
      (visibleColumns as unknown as {[key: string]: boolean}) || {}
    );
    const defaultKeys = Object.keys(defaultVisibleColumns);
    const newColumns = defaultKeys.filter(key => !currentVisibleKeys.includes(key));

    if (newColumns.length > 0) {
      setVisibleColumns({
        ...visibleColumns,
        ...Object.fromEntries(newColumns.map(key => [key, true]))
      });
    }
  }, [bucketId, defaultVisibleColumns, formattedColumns]);

  const toggleColumn = (key?: string) => {
    if (key) {
      setVisibleColumns({
        ...visibleColumns,
        [key]: !visibleColumns[key]
      });
      return;
    }

    const hasHiddenColumns = Object.values(visibleColumns).some(isVisible => !isVisible);

    if (hasHiddenColumns) {
      setVisibleColumns(defaultVisibleColumns);
    } else {
      // Hide all columns except _id
      setVisibleColumns(
        Object.fromEntries(formattedColumns.map(col => [col.key, col.key === "_id"]))
      );
    }
  };

  return {
    formattedColumns,
    filteredColumns,
    visibleColumns,
    searchableColumns,
    toggleColumn
  };
}


