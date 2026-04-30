import {
  FlexElement,
  Table,
  type TableColumn,
  type TableRowClickParams,
  type TableCellParams,
  type TableCellKeyDownParams,
  type TableSkeletonCellParams,
} from 'oziko-ui-kit';
import React from 'react'
import styles from './Table.module.scss';

export const TableHeader = ({ children }: { children: React.ReactNode }) => {
  return <FlexElement dimensionX="fill" alignment="leftCenter" className={styles.tableHeader}>{children}</FlexElement>;
};


type SpicaTableProps<T> = {
  columns: TableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  skeletonRowCount?: number;
  renderSkeletonCell?: (params: TableSkeletonCellParams<T>) => React.ReactNode;
  fixedColumns?: string[];
  noResizeableColumns?: string[];
  tableClassName?: string;
  cellClassName?: string;
  isCellFocusable?: (params: TableCellParams<T>) => boolean;
  onCellKeyDown?: (params: TableCellKeyDownParams) => void;
  onRowClick?: (params: TableRowClickParams<T>) => void;
}


const NO_CELL_FOCUS = () => false;

const SpicaTable = <T,>({
  columns,
  data,
  isLoading,
  skeletonRowCount,
  renderSkeletonCell,
  fixedColumns,
  noResizeableColumns,
  tableClassName,
  cellClassName,
  isCellFocusable = NO_CELL_FOCUS,
  onCellKeyDown,
  onRowClick,
}: SpicaTableProps<T>) => {
  return (
    <Table
      columns={columns}
      data={data}
      tableClassName={tableClassName ?? styles.table}
      headerClassName={`${styles.header} ${styles.policyTableHeaders}`}
      columnClassName={`${styles.column} ${styles.policyTableColumns}`}
      cellClassName={cellClassName ? `${styles.cell} ${cellClassName}` : styles.cell}
      loading={isLoading}
      skeletonRowCount={skeletonRowCount ?? 10}
      renderSkeletonCell={renderSkeletonCell}
      fixedColumns={fixedColumns ?? []}
      noResizeableColumns={noResizeableColumns}
      isCellFocusable={isCellFocusable}
      onCellKeyDown={onCellKeyDown}
      onRowClick={onRowClick}
    />
  )
}

export default SpicaTable