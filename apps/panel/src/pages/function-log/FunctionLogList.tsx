import {memo, useMemo, type ReactNode} from "react";
import {
  Accordion,
  Button,
  FlexElement,
  Input,
  Icon,
  Text,
  type TypeAccordionItem,
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
  filterActions?: ReactNode;
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
  filterActions,
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
      <FlexElement direction="vertical" dimensionX="fill" gap={8} className={styles.listHeader}>
        {/* Row 1: search | clear + refresh + results */}
        <FlexElement alignment="leftCenter" dimensionX="fill" gap={8}>
          <FlexElement alignment="leftCenter" gap={8} className={styles.searchRow}>
            <Icon name="magnify" size="sm" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              dimensionX={300}
              debounceDelay={200}
            />
          </FlexElement>
          <FlexElement alignment="rightCenter" dimensionX="fill" gap={8}>
            {toolbarActions}
            <Button variant="solid" color="soft" onClick={onRefresh} type="button" loading={isRefreshing} disabled={isRefreshing}>
              <Icon name="refresh" size="sm" />
              Refresh
            </Button>
            <Text className={styles.resultCount}>{logs.length} Results</Text>
          </FlexElement>
        </FlexElement>

        {/* Row 2: date range filter + reset */}
        {(filterActions || isFilterApplied) && (
          <FlexElement alignment="leftCenter" dimensionX="fill" gap={8}>
            {filterActions}
            {isFilterApplied && (
              <Button onClick={onReset} type="button">
                <Icon name="undo" size="sm" />
                Reset
              </Button>
            )}
          </FlexElement>
        )}
      </FlexElement>
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
