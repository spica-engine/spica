import type {CollectedRelation, TypeDataColumn} from "./TableTypes";
import { FieldKind, type FormError } from "../../../domain/fields/types";
import type { Properties, Property } from "../../../services/bucketService";

export const MIN_COLUMN_WIDTH = 160;

export function parseWidth(widthValue: string | number, containerWidth: number): number {
  const baseFontSize = 16;

  if (typeof widthValue === "number") return widthValue;
  if (widthValue.endsWith("px")) return parseFloat(widthValue);
  if (widthValue.endsWith("rem")) return parseFloat(widthValue) * baseFontSize;
  if (widthValue.endsWith("em")) return parseFloat(widthValue) * baseFontSize;
  if (widthValue.endsWith("%")) return (parseFloat(widthValue) / 100) * containerWidth;
  return 0;
}

function getCalculatedColumnWidth(columns: TypeDataColumn[], containerWidth: number): string {
  const totalDefinedWidth = columns.reduce((total, column) => {
    if (!column.width) return total;
    return total + parseWidth(column.width, containerWidth);
  }, 0);

  const columnsWithoutWidth = columns.filter(column => column.width === undefined)?.length;
  const availableWidth = Math.max(containerWidth - totalDefinedWidth, 0);

  const distributedWidth = availableWidth / columnsWithoutWidth;
  return `${Math.max(distributedWidth, MIN_COLUMN_WIDTH)}px`;
}

export function getFormattedColumns(containerWidth: number, columns: TypeDataColumn[]) {
  const allColumnsHaveWidth =
    columns.filter(col => col.width !== undefined || col.width !== null).length === columns.length;

  if (allColumnsHaveWidth) {
    const fixedWidthColumns = columns.filter(col => col.fixedWidth);
    const resizableColumns = columns.filter(col => !col.fixedWidth);

    const fixedWidthTotal = fixedWidthColumns.reduce(
      (total, col) => total + parseWidth(col.width as string, containerWidth),
      0
    );

    const remainingWidth = Math.max(containerWidth - fixedWidthTotal, 0);

    const resizableColumnsLength = Math.max(resizableColumns.length, 1);
    const widthPerResizableColumn = Math.max(
      remainingWidth / resizableColumnsLength,
      MIN_COLUMN_WIDTH
    );

    return columns.map(col => ({
      ...col,
      width: col.fixedWidth ? col.width : `${widthPerResizableColumn}px`
    }));
  }
  const defaultColumnWidth = getCalculatedColumnWidth(columns, containerWidth);

  const columnsWithWidth = columns.map(column => {
    return {...column, width: column.width || defaultColumnWidth};
  });

  const formattedColumns: TypeDataColumn[] = [];
  let cumulativeOffset = 0;

  for (let column of columnsWithWidth) {
    if (!column.fixed) {
      formattedColumns.push(column);
      continue;
    }

    const columnWidth = parseWidth(column.width, containerWidth);
    const fixedLeftOffset = cumulativeOffset;

    formattedColumns.push({...column, width: `${columnWidth}px`, leftOffset: fixedLeftOffset});

    cumulativeOffset += columnWidth;
  }

  return formattedColumns;
}

export const isObjectEffectivelyEmpty = (obj: any): boolean => {
  if (obj == null || typeof obj !== "object") return true;

  return Object.keys(obj).every(key => {
    return (
      obj[key] === undefined ||
      obj[key] === null ||
      (typeof obj[key] === "object" && isObjectEffectivelyEmpty(obj[key]))
    );
  });
};

export const findFirstErrorId = (errors: FormError, formattedProperties?: Properties): string | null => {
  if (!formattedProperties) return null;
  for (const [key, error] of Object.entries(errors ?? {})) {
    const property = formattedProperties[key];

    if (typeof error === "string" && property?.id) {
      return property.id;
    } else if (typeof error === "object" && property?.properties) {
      const nestedId = findFirstErrorId(error, property.properties);
      if (nestedId) return nestedId;
    }
  }
  return null;
};

export function collectBucketIds(Properties: Properties, cellValue: any): CollectedRelation[] {
  const collected: CollectedRelation[] = [];

  function traverse(property: Property, value: any) {
    if (!property || typeof property !== "object") return;
    if (property.type === FieldKind.Relation) {
      const relationValue = value?.[property.title as any];
      collected.push({bucketId: property.bucketId as string, value: relationValue});
    }

    if (property.type === FieldKind.Object || property.type === FieldKind.Array) {
      for (const prop of Object.values(property.properties || {})) {
        const childValue = value?.[(prop as Property).title];
        if (prop && (typeof childValue === "object" || !childValue))
          traverse(prop as Property, childValue);
      }
    }
  }
  for (const prop of Object.values(Properties || {})) {
    traverse(prop, cellValue);
  }
  return collected;
}