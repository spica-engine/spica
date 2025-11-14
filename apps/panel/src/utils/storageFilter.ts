import type {TypeFilterValue} from "oziko-ui-kit";
import {convertQuickDateToRange, convertToBytes} from "./storage";

export const STORAGE_TYPE_OPTIONS = [
  {value: "jpg", label: "JPG"},
  {value: "png", label: "PNG"},
  {value: "mp4", label: "MP4"}
] as const;

export const STORAGE_SIZE_UNITS: string[] = ["kb", "mb", "gb", "tb"];

export const STORAGE_CREATED_AT_PRESETS = [
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
] as const;

export type StorageFilterQuery = Record<string, unknown>;

const STORAGE_FILTER_TEMPLATE: TypeFilterValue = {
  type: STORAGE_TYPE_OPTIONS.map(option => option.value),
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
};

const sortTypes = (types: string[]) => [...types].filter(Boolean).sort();

export const cloneStorageFilterValues = (filter: TypeFilterValue): TypeFilterValue => ({
  type: [...filter.type],
  fileSize: {
    min: {
      value: filter.fileSize.min.value,
      unit: filter.fileSize.min.unit
    },
    max: {
      value: filter.fileSize.max.value,
      unit: filter.fileSize.max.unit
    }
  },
  quickdate: filter.quickdate,
  dateRange: {
    from: filter.dateRange.from,
    to: filter.dateRange.to
  }
});

export const createStorageFilterDefaultValues = (): TypeFilterValue =>
  cloneStorageFilterValues(STORAGE_FILTER_TEMPLATE);

const areTypeSelectionsEqual = (first: string[], second: string[]): boolean => {
  const a = sortTypes(first);
  const b = sortTypes(second);

  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
};

export const areStorageFiltersEqual = (first: TypeFilterValue, second: TypeFilterValue): boolean => {
  if (!areTypeSelectionsEqual(first.type, second.type)) {
    return false;
  }

  if (
    first.fileSize.min.value !== second.fileSize.min.value ||
    first.fileSize.min.unit !== second.fileSize.min.unit ||
    first.fileSize.max.value !== second.fileSize.max.value ||
    first.fileSize.max.unit !== second.fileSize.max.unit
  ) {
    return false;
  }

  if (first.quickdate !== second.quickdate) {
    return false;
  }

  return first.dateRange.from === second.dateRange.from && first.dateRange.to === second.dateRange.to;
};

export const isDefaultStorageFilter = (filter: TypeFilterValue): boolean =>
  areStorageFiltersEqual(filter, STORAGE_FILTER_TEMPLATE);

const ensureDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
};

const withFileGuard = (condition: Record<string, unknown>) => ({
  $and: [
    {
      "content.type": {$ne: "inode/directory"}
    },
    condition
  ]
});

export const buildStorageFilterQuery = (filter: TypeFilterValue): StorageFilterQuery | null => {
  const filterConditions: Record<string, unknown>[] = [];
  const defaultFilter = STORAGE_FILTER_TEMPLATE;

  if (filter.type.length > 0 && !areTypeSelectionsEqual(filter.type, defaultFilter.type)) {
    const typeRegex = filter.type.map(type => `\\.${type}$`).join("|");
    if (typeRegex) {
      filterConditions.push(
        withFileGuard({
          name: {$regex: `(${typeRegex})`, $options: "i"}
        })
      );
    }
  }

  const minBytes =
    filter.fileSize.min.value !== null
      ? convertToBytes(filter.fileSize.min.value, filter.fileSize.min.unit)
      : null;
  const maxBytes =
    filter.fileSize.max.value !== null
      ? convertToBytes(filter.fileSize.max.value, filter.fileSize.max.unit)
      : null;

  const hasCustomSize =
    (filter.fileSize.min.value !== defaultFilter.fileSize.min.value ||
      filter.fileSize.min.unit !== defaultFilter.fileSize.min.unit) ||
    (filter.fileSize.max.value !== defaultFilter.fileSize.max.value ||
      filter.fileSize.max.unit !== defaultFilter.fileSize.max.unit);

  if (hasCustomSize && (minBytes !== null || maxBytes !== null)) {
    const sizeConditions: Record<string, number> = {};
    if (minBytes !== null) {
      sizeConditions.$gte = minBytes;
    }
    if (maxBytes !== null) {
      sizeConditions.$lte = maxBytes;
    }

    if (Object.keys(sizeConditions).length > 0) {
      filterConditions.push(
        withFileGuard({
          "content.size": sizeConditions
        })
      );
    }
  }

  let dateRange: {from: Date | null; to: Date | null} | null = null;

  if (filter.quickdate) {
    dateRange = convertQuickDateToRange(filter.quickdate);
  } else if (filter.dateRange.from || filter.dateRange.to) {
    dateRange = {
      from: ensureDate(filter.dateRange.from),
      to: ensureDate(filter.dateRange.to)
    };
  }

  if (dateRange && (dateRange.from || dateRange.to)) {
    const dateConditions: Record<string, string> = {};
    if (dateRange.from) {
      dateConditions.$gte = dateRange.from.toISOString();
    }
    if (dateRange.to) {
      dateConditions.$lte = dateRange.to.toISOString();
    }

    if (Object.keys(dateConditions).length > 0) {
      filterConditions.push({
        $or: [{created_at: dateConditions}, {createdAt: dateConditions}]
      });
    }
  }

  if (!filterConditions.length) {
    return null;
  }

  if (filterConditions.length === 1) {
    return filterConditions[0];
  }

  return {$and: filterConditions};
};

