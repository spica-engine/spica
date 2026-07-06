/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useMemo} from "react";
import {useClearFunctionLogsMutation, useGetFunctionLogsQuery} from "../../../store/api/functionApi";
import useFunctionLogFilterState from "../../../hooks/useFunctionLogFilterState";
import {LOG_LEVEL_LABELS} from "../../../utils/functionLogLevels";
import {
  formatRowTimestamp,
  getLogDate,
} from "../../../utils/functionLogUtils";
import FunctionLogRail from "./FunctionLogRail";
import FunctionLogTable from "./FunctionLogTable";
import FunctionLogToolbar from "./FunctionLogToolbar";
import styles from "./FunctionLogView.module.scss";

type FunctionLogViewProps = {
  functionId: string;
  functionName: string;
  defaultHandlerName: string;
  isOpen: boolean;
  onToggle: () => void;
};

const FunctionLogView = ({
  functionId,
  functionName,
  defaultHandlerName,
  isOpen,
  onToggle,
}: FunctionLogViewProps) => {
  const {
    defaultRange,
    queryRange,
    setQueryRange,
    draftBegin,
    setDraftBegin,
    draftEnd,
    setDraftEnd,
    searchQuery,
    setSearchQuery,
    handlerFilter,
    severityFilters,
    toggleSeverity,
    selectedLevels,
    isFilterOpen,
    setIsFilterOpen,
    expandedLogIds,
    setExpandedLogIds,
    sortDirection,
    setSortDirection,
    handleFilterToggle,
    handleReset,
    isFilterApplied,
    toggleRow,
  } = useFunctionLogFilterState();

  const {data: logs = [], isFetching, refetch} = useGetFunctionLogsQuery(
    {
      functions: [functionId],
      begin: queryRange.begin.toISOString(),
      end: queryRange.end.toISOString(),
      limit: 100,
      sort: {_id: -1},
      levels: selectedLevels,
    },
    {skip: !functionId || !isOpen}
  );

  const [clearFunctionLogs, {isLoading: isClearingLogs}] = useClearFunctionLogsMutation();

  const handleApplyFilter = useCallback(() => {
    const nextBegin = new Date(draftBegin);
    const nextEnd = new Date(draftEnd);
    if (Number.isNaN(nextBegin.getTime()) || Number.isNaN(nextEnd.getTime()) || nextBegin > nextEnd) {
      return;
    }

    setQueryRange({begin: nextBegin, end: nextEnd});
    setExpandedLogIds([]);
    setIsFilterOpen(false);
  }, [draftBegin, draftEnd, setExpandedLogIds, setIsFilterOpen, setQueryRange]);

  const handleClearLogs = useCallback(async () => {
    if (!functionId) {
      return;
    }

    await clearFunctionLogs({
      functionId,
      begin: queryRange.begin.toISOString(),
      end: queryRange.end.toISOString(),
    });

    refetch();
  }, [clearFunctionLogs, functionId, queryRange.begin, queryRange.end, refetch]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const normalizedHandler = handlerFilter.trim().toLowerCase();

    return logs
      .filter(log => {
        const timestamp = getLogDate(log);
        if (timestamp < queryRange.begin || timestamp > queryRange.end) {
          return false;
        }

        if (normalizedHandler && !defaultHandlerName.toLowerCase().includes(normalizedHandler)) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchableContent = [
          functionName,
          defaultHandlerName,
          LOG_LEVEL_LABELS[log.level] ?? "",
          log.content,
          formatRowTimestamp(log),
        ]
          .join(" ")
          .toLowerCase();

        return searchableContent.includes(normalizedSearch);
      })
      .sort((left, right) => {
        const delta = getLogDate(left).getTime() - getLogDate(right).getTime();
        return sortDirection === "asc" ? delta : -delta;
      });
  }, [defaultHandlerName, functionName, handlerFilter, logs, queryRange.begin, queryRange.end, searchQuery, sortDirection]);

  return (
    <div className={styles.logView}>
      <FunctionLogRail
        functionName={functionName}
        isOpen={isOpen}
        resultCount={filteredLogs.length}
        onToggle={onToggle}
      />

      {isOpen && (
        <div className={styles.logSurface}>
          <FunctionLogToolbar
            queryRange={queryRange}
            draftBegin={draftBegin}
            draftEnd={draftEnd}
            isFilterOpen={isFilterOpen}
            isFilterApplied={isFilterApplied}
            isFetching={isFetching}
            isClearingLogs={isClearingLogs}
            hasLogs={logs.length > 0}
            onDraftBeginChange={setDraftBegin}
            onDraftEndChange={setDraftEnd}
            onFilterToggle={handleFilterToggle}
            onFilterClose={() => setIsFilterOpen(false)}
            onFilterReset={handleReset}
            onFilterApply={handleApplyFilter}
            onRefresh={refetch}
            onClear={handleClearLogs}
          />

          <FunctionLogTable
            logs={filteredLogs}
            isFetching={isFetching}
            functionName={functionName}
            defaultHandlerName={defaultHandlerName}
            searchQuery={searchQuery}
            severityFilters={severityFilters}
            sortDirection={sortDirection}
            expandedLogIds={expandedLogIds}
            onSearchChange={setSearchQuery}
            onSeverityToggle={toggleSeverity}
            onSortDirectionChange={setSortDirection}
            onToggleRow={toggleRow}
          />
        </div>
      )}
    </div>
  );
};

export default memo(FunctionLogView);
