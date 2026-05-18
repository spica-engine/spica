import {
  FlexElement,
  Table,
  type TableColumn,
  type TableEmptyStateProps,
  type TableRowClickParams,
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
  onRowClick?: (params: TableRowClickParams<T>) => void;
  emptyState?: TableEmptyStateProps;
}


const SpicaTable = <T,>({
  columns,
  data,
  isLoading,
  skeletonRowCount,
  renderSkeletonCell,
  fixedColumns,
  noResizeableColumns,
  onRowClick,
  emptyState,
}: SpicaTableProps<T>) => {
  return (
    <Table
      columns={columns}
      data={data}
      loading={isLoading}
      skeletonRowCount={skeletonRowCount ?? 10}
      renderSkeletonCell={renderSkeletonCell}
      fixedColumns={fixedColumns ?? []}
      noResizeableColumns={noResizeableColumns}
      onRowClick={onRowClick}
      emptyState={emptyState}
    />
  )
}

export default SpicaTable