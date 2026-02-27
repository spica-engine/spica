/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useMemo, useState} from "react";
import {Button, FlexElement, Icon, Text} from "oziko-ui-kit";
import {useGetFunctionLogsQuery} from "../../../store/api/functionApi";
import type {FunctionLog} from "../../../store/api/functionApi";
import styles from "../FunctionPage.module.scss";

type FunctionLogViewProps = {
  functionId: string;
};

const LOG_LEVELS: {value: number; label: string}[] = [
  {value: 0, label: "Debug"},
  {value: 1, label: "Log"},
  {value: 2, label: "Info"},
  {value: 3, label: "Warning"},
  {value: 4, label: "Error"},
];

const LEVEL_CLASS: Record<number, string> = {
  0: styles.logDebug,
  1: styles.logInfo,
  2: styles.logInfo,
  3: styles.logWarning,
  4: styles.logError,
};

const PAGE_SIZE = 40;

const FunctionLogView = ({functionId}: FunctionLogViewProps) => {
  const [skip, setSkip] = useState(0);
  const [selectedLevels, setSelectedLevels] = useState<number[]>([]);

  const today = useMemo(() => {
    const d = new Date();
    return {
      begin: new Date(d.setHours(0, 0, 0, 0)).toISOString(),
      end: new Date(d.setHours(23, 59, 59, 999)).toISOString(),
    };
  }, []);

  const {data: logs = [], isLoading, refetch} = useGetFunctionLogsQuery({
    functions: [functionId],
    begin: today.begin,
    end: today.end,
    limit: PAGE_SIZE,
    skip,
    sort: {_id: -1},
    ...(selectedLevels.length > 0 ? {levels: selectedLevels} : {}),
  });

  const handleRefresh = useCallback(() => {
    setSkip(0);
    refetch();
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    setSkip(prev => prev + PAGE_SIZE);
  }, []);

  const toggleLevel = useCallback((level: number) => {
    setSelectedLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
    setSkip(0);
  }, []);

  const formatTimestamp = useCallback((log: FunctionLog) => {
    const ts = Number.parseInt(log._id.substring(0, 8), 16) * 1000;
    return new Date(ts).toLocaleString();
  }, []);

  return (
    <div className={styles.logView}>
      <FlexElement dimensionX="fill" alignment="spaceBetween" className={styles.logToolbar}>
        <FlexElement gap={8} alignment="leftCenter">
          <Text size="small" className={styles.logTitle}>Logs</Text>
          {LOG_LEVELS.map(level => (
            <button
              key={level.value}
              className={`${styles.levelFilter} ${selectedLevels.includes(level.value) ? styles.levelActive : ""}`}
              onClick={() => toggleLevel(level.value)}
            >
              {level.label}
            </button>
          ))}
        </FlexElement>
        <FlexElement gap={4}>
          <Button variant="icon" color="transparent" onClick={handleRefresh}>
            <Icon name="refresh" size="sm" />
          </Button>
        </FlexElement>
      </FlexElement>
      <div className={styles.logList}>
        {isLoading && <Text size="small" className={styles.logEmpty}>Loading...</Text>}
        {!isLoading && logs.length === 0 && (
          <Text size="small" className={styles.logEmpty}>No logs found</Text>
        )}
        {logs.map(log => (
          <div key={log._id} className={`${styles.logEntry} ${LEVEL_CLASS[log.level] ?? ""}`}>
            <span className={styles.logTimestamp}>{formatTimestamp(log)}</span>
            <span className={styles.logContent}>{log.content}</span>
          </div>
        ))}
        {!isLoading && logs.length >= PAGE_SIZE && (
          <button className={styles.loadMoreButton} onClick={handleLoadMore}>
            Load more
          </button>
        )}
      </div>
    </div>
  );
};

export default memo(FunctionLogView);
