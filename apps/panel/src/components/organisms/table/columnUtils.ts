import type {TypeDataColumn} from "./types";

export const MIN_COLUMN_WIDTH = 160;

export const parseWidth = (widthValue: string | number, containerWidth: number): number => {
  const baseFontSize = 16;

  if (typeof widthValue === "number") return widthValue;
  if (widthValue.endsWith("px")) return parseFloat(widthValue);
  if (widthValue.endsWith("rem")) return parseFloat(widthValue) * baseFontSize;
  if (widthValue.endsWith("em")) return parseFloat(widthValue) * baseFontSize;
  if (widthValue.endsWith("%")) return (parseFloat(widthValue) / 100) * containerWidth;
  return 0;
};

export const getFormattedColumns = (containerWidth: number, columns: TypeDataColumn[]) => {
  const totalDefinedWidth = columns.reduce((total, column) => {
    if (!column.width) return total;
    return total + parseWidth(column.width, containerWidth + 10);
  }, 0);

  const columnsWithoutWidth = columns.filter(column => column.width === undefined)?.length;
  const availableWidth = Math.max(containerWidth + 10 - totalDefinedWidth, 0);

  const distributedWidth = columnsWithoutWidth > 0 ? availableWidth / columnsWithoutWidth : 0;
  const defaultColumnWidth = `${Math.max(distributedWidth, MIN_COLUMN_WIDTH)}px`;

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
};
