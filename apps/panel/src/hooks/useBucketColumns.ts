import {useMemo, useEffect} from "react";
import type {BucketType} from "../store/api/bucketApi";
import type {ColumnType} from "../components/organisms/bucket-table/BucketTable";
import useLocalStorage from "./useLocalStorage";

// Types whose values can't be matched with a case-insensitive text regex.
// Everything else (string, textarea, richtext, color, hash, encrypted, and any
// custom scalar text field) is treated as searchable.
const NON_SEARCHABLE_TYPES = new Set([
  "relation",
  "location",
  "object",
  "array",
  "multiselect",
  "json",
  "storage",
  "boolean",
  "number",
  "date"
]);

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
      // Derive from bucket.properties directly (not formattedColumns) so the
      // regex filter targets the real property KEY the document is stored under.
      // formattedColumns exposes `key: title`, which silently breaks search
      // whenever a field's title differs from its key (e.g. an "id" field).
      // Blocklist structural / non-text types instead of allow-listing a few
      // string types, so text-like fields (color, hash, encrypted, and any
      // custom scalar text field) are all searched.
      Object.entries(bucket?.properties ?? {})
        .filter(([, prop]: [string, any]) => !NON_SEARCHABLE_TYPES.has(prop?.type))
        .map(([key]) => key),
    [bucket]
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


