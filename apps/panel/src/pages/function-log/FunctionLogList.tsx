import {memo, useMemo} from "react";
import {
  Accordion,
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
};

const FunctionLogList = ({
  logs,
  searchQuery,
  onSearchChange,
  functionNames,
  handlerNames
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
        suffix={{children: <Text className={styles.resultCount}>{logs.length} Results</Text>}}
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
