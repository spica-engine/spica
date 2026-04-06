import {memo, useMemo} from "react";
import styles from "./DashboardTable.module.scss";
import {FlexElement, Table, Text} from "oziko-ui-kit";
import type {DashboardRatio} from "../../../store/api/dashboardApi";

type DashboardTableProps = {
  componentData?: any;
  ratio: DashboardRatio;
  title?: string;
  onUpdate?: (filter: object) => void;
};

const DashboardTable = ({componentData, title, onUpdate}: DashboardTableProps) => {
  const columns = useMemo(() => {
    if (!componentData?.data?.length) return [];
    const keys =
      componentData.displayedColumns ??
      componentData.columns ??
      Object.keys(componentData.data[0] ?? {});
    return keys.map((key: string) => ({
      key,
      title: key.charAt(0).toUpperCase() + key.slice(1),
      renderCell: (row: Record<string, any>) => (
        <Text size="small">{String(row[key] ?? "")}</Text>
      ),
    }));
  }, [componentData]);

  const data = componentData?.data ?? [];

  return (
    <FlexElement dimensionX="fill" dimensionY="fill" direction="vertical" gap={0} className={styles.dashboardTable}>
      <FlexElement dimensionX="fill" alignment="leftTop" className={styles.header}>
        <Text>{title ?? "Table"}</Text>
      </FlexElement>
      <FlexElement dimensionX="fill" alignment="leftTop" className={styles.content}>
        <Table columns={columns} data={data} />
      </FlexElement>
    </FlexElement>
  );
};

export default memo(DashboardTable);
