import {memo, useMemo, type ReactNode} from "react";
import {
  Accordion,
  Button,
  FlexElement,
  Input,
  Icon,
  Text,
  type TypeAccordionItem,
  FluidContainer
} from "oziko-ui-kit";
import type {FunctionLog} from "../../store/api/functionApi";
import {buildAccordionItem} from "./FunctionLogAccordionItem";
import styles from "./FunctionLogPage.module.scss";

type FunctionLogListProps = {
  logs: FunctionLog[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  functionNames: Record<string, string>;
  handlerNames: Record<string, string>;
  onRefresh: () => void;
  onReset: () => void;
  isFilterApplied: boolean;
  isRefreshing: boolean;
  toolbarActions?: ReactNode;
};

const FunctionLogList = ({
  logs,
  searchQuery,
  onSearchChange,
  functionNames,
  handlerNames,
  onRefresh,
  onReset,
  isFilterApplied,
  isRefreshing,
  toolbarActions,
}: FunctionLogListProps) => {
  const accordionItems = useMemo<TypeAccordionItem[]>(
    () =>
      logs.map(log =>
        buildAccordionItem(
          log,
          functionNames[log.function] ?? log.function,
          handlerNames[log.function] ?? "default"
        )
      ),
    [logs, functionNames, handlerNames]
  );

  return (
    <FlexElement
      alignment="leftCenter"
      direction="vertical"
      gap={16}
      className={styles.listContainer}
      dimensionX="fill"
    >
      <FluidContainer
        dimensionX="fill"
        mode="fill"
        className={styles.listHeader}
        prefix={{
          children: (
            <>
              <Icon name="magnify" size="sm" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                dimensionX={300}
                debounceDelay={200}
              />
            </>
          ),
          className: styles.searchRow,
          alignment: "leftCenter"
        }}
        root={{children: <></>}}
        suffix={{
          children: (
            <FlexElement alignment="rightCenter" gap={8}>
              {toolbarActions}
              <Button variant="solid" color="soft" onClick={onRefresh} type="button" loading={isRefreshing} disabled={isRefreshing}>
                <Icon name="refresh" size="sm" />
                Refresh
              </Button>
              {isFilterApplied && (
                <Button onClick={onReset} type="button">
                  <Icon name="undo" size="sm" />
                  Reset
                </Button>
              )}
              <Text className={styles.resultCount}>{logs.length} Results</Text>
            </FlexElement>
          )
        }}
      />
      <FlexElement className={styles.logList} dimensionX="fill" direction="vertical">
        <div className={styles.columnHeader}>
          <span>Severity</span>
          <span>Timestamp</span>
          <span>Function</span>
          <span>Handler</span>
          <span>Content</span>
        </div>
        {logs.length === 0 ? (
          <FlexElement dimensionX="fill" alignment="center" className={styles.emptyState}>
            There are no logs currently.
          </FlexElement>
        ) : (
          <Accordion
            items={accordionItems}
            itemClassName={styles.accordionItem}
            headerClassName={styles.accordionHeader}
            contentClassName={styles.accordionContent}
            noBackgroundOnFocus
            disableSuffixIcon
            gap={0}
          />
        )}
      </FlexElement>
    </FlexElement>
  );
};

export default memo(FunctionLogList);
