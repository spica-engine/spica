import { FlexElement, Table, type TableColumn } from 'oziko-ui-kit';
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
}


const SpicaTable = <T,>({ columns, data, isLoading, skeletonRowCount }: SpicaTableProps<T>) => {
  return (
    <Table
    columns={columns}
    data={data}
    tableClassName={styles.table}
    headerClassName={`${styles.header} ${styles.policyTableHeaders}`}
    columnClassName={`${styles.column} ${styles.policyTableColumns}`}
    cellClassName={styles.cell}
    loading={isLoading}
    skeletonRowCount={skeletonRowCount ?? 10}
  />
  )
}

export default SpicaTable