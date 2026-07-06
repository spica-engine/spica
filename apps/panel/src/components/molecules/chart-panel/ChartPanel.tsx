import {type ReactNode, memo} from "react";
import styles from "./ChartPanel.module.scss";
import {FlexElement, Text} from "oziko-ui-kit";

export type ChartPanelStatus = "loading" | "empty" | "error" | "ready";

type ChartPanelProps = {
  title: string;
  subtitle?: string;
  status?: ChartPanelStatus;
  emptyMessage?: string;
  errorMessage?: string;
  scrollX?: boolean;
  minContentWidth?: number;
  children?: ReactNode;
};

const ChartPanel = ({
  title,
  subtitle,
  status = "ready",
  emptyMessage = "No data yet",
  errorMessage = "Couldn't load data",
  scrollX = false,
  minContentWidth,
  children
}: ChartPanelProps) => {
  const renderState = () => {
    if (status === "loading") return <Text className={styles.stateText}>Loading…</Text>;
    if (status === "error") return <Text className={styles.stateText}>{errorMessage}</Text>;
    if (status === "empty") return <Text className={styles.stateText}>{emptyMessage}</Text>;
    return null;
  };

  const stateNode = renderState();

  return (
    <FlexElement
      className={styles.chartPanel}
      direction="vertical"
      gap={0}
      dimensionX="fill"
      dimensionY="fill"
    >
      <FlexElement className={styles.header} direction="vertical" gap={2} dimensionX="fill">
        <Text className={styles.title}>{title}</Text>
        {subtitle && <Text className={styles.subtitle}>{subtitle}</Text>}
      </FlexElement>

      <div className={styles.body}>
        {stateNode ? (
          <div className={styles.state}>{stateNode}</div>
        ) : scrollX ? (
          <div className={styles.scrollArea}>
            <div
              className={styles.scrollInner}
              style={minContentWidth ? {minWidth: `${minContentWidth}px`} : undefined}
            >
              {children}
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </FlexElement>
  );
};

export default memo(ChartPanel);
