/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {Fragment, useCallback, useEffect, useMemo, useState} from "react";
import {Popover, Select} from "oziko-ui-kit";
import {useGetFunctionLogsQuery, useGetFunctionsQuery, useClearFunctionLogsMutation} from "../../store/api/functionApi";
import type {FunctionLog} from "../../store/api/functionApi";
import {useFunctionLogChartDrag} from "../../hooks/useFunctionLogChartDrag";
import useFunctionLogFilterState from "../../hooks/useFunctionLogFilterState";
import {
  LOG_LEVEL_LABELS,
  SEVERITY_CHIPS,
  getSeverityBadge,
  getSeverityFilter,
  type SeverityFilter,
} from "../../utils/functionLogLevels";
import {
  buildTimeBuckets,
  clampRatio,
  DEFAULT_BRUSH_RANGE,
  formatRowTimestamp,
  formatTimelineLabel,
  formatToolbarDate,
  getLogDate,
} from "../../utils/functionLogUtils";
import styles from "./FunctionLogPage.module.scss";

type FunctionDescriptor = {
  id: string;
  name: string;
  handlerName: string;
};

const SEVERITY_CLASS: Record<SeverityFilter, string> = {
  all: styles.severityAll,
  info: styles.severityInfo,
  warning: styles.severityWarning,
  error: styles.severityError,
  debug: styles.severityDebug,
};

const FunctionLogPage = () => {
  const [draftFunctionIds, setDraftFunctionIds] = useState<string[]>([]);
  const [activeFunctionIds, setActiveFunctionIds] = useState<string[]>([]);
  const {brushRange, setBrushRange, chartTrackRef, handleChartPointerDown} = useFunctionLogChartDrag();

  const [clearFunctionLogs, {isLoading: isClearingLogs}] = useClearFunctionLogsMutation();

  const {data: functions, isError: isFunctionsError} = useGetFunctionsQuery();
  const functionList = Array.isArray(functions) ? functions : functions?.data;

  const functionItems = useMemo<FunctionDescriptor[]>(() => {
    if (isFunctionsError || !Array.isArray(functionList) || functionList.length === 0)
      return [];

    return functionList
      .map(fn => {
        const triggers = fn.triggers;
        let handler = "default";
        if (Array.isArray(triggers) && triggers.length > 0) {
          handler = triggers[0].handler ?? "default";
        } else if (triggers && typeof triggers === "object") {
          const firstKey = Object.keys(triggers)[0];
          if (firstKey) handler = firstKey;
        }
        return {
          id: fn._id!,
          name: fn.name,
          handlerName: handler,
        };
      })
      .filter(item => Boolean(item.id));
  }, [functionList, isFunctionsError]);

  useEffect(() => {
    const validIds = new Set(functionItems.map(item => item.id));
    setActiveFunctionIds(current => current.filter(id => validIds.has(id)));
  }, [functionItems]);

  const functionOptions = useMemo(
    () => functionItems.map(item => ({label: item.name, value: item.id})),
    [functionItems]
  );

  const syncFunctionDraft = useCallback(() => {
    setDraftFunctionIds(activeFunctionIds);
  }, [activeFunctionIds]);

  const resetExtraFilters = useCallback(() => {
    setDraftFunctionIds([]);
    setActiveFunctionIds([]);
    setBrushRange(DEFAULT_BRUSH_RANGE);
  }, [setBrushRange]);

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
    severityFilter,
    setSeverityFilter,
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
  } = useFunctionLogFilterState({onSyncDrafts: syncFunctionDraft, onReset: resetExtraFilters});

  const functionNameMap = useMemo<Record<string, string>>(
    () => Object.fromEntries(functionItems.map(item => [item.id, item.name])),
    [functionItems]
  );

  const handlerNameMap = useMemo<Record<string, string>>(
    () => Object.fromEntries(functionItems.map(item => [item.id, item.handlerName])),
    [functionItems]
  );

  const {data: apiLogs = [], refetch, isFetching} = useGetFunctionLogsQuery(
    {
      begin: queryRange.begin.toISOString(),
      end: queryRange.end.toISOString(),
      limit: 100,
      sort: {_id: -1},
      functions: activeFunctionIds.length > 0 ? activeFunctionIds : undefined,
      levels: selectedLevels,
    }
  );

  const logs = useMemo<FunctionLog[]>(() => apiLogs ?? [], [apiLogs]);

  const timelineLogs = logs;

  const chartBuckets = useMemo(() => buildTimeBuckets(timelineLogs, queryRange), [queryRange, timelineLogs]);

  const maxBucketCount = useMemo(
    () => Math.max(...chartBuckets.map(bucket => bucket.count), 1),
    [chartBuckets]
  );

  const brushedRange = useMemo(() => {
    const beginTime = queryRange.begin.getTime();
    const duration = Math.max(queryRange.end.getTime() - beginTime, 1);

    return {
      begin: new Date(beginTime + duration * brushRange.startRatio),
      end: new Date(beginTime + duration * brushRange.endRatio),
    };
  }, [brushRange.endRatio, brushRange.startRatio, queryRange]);

  const timeLabels = useMemo(() => {
    const beginTime = queryRange.begin.getTime();
    const duration = Math.max(queryRange.end.getTime() - beginTime, 1);
    const sameDay = queryRange.begin.toDateString() === queryRange.end.toDateString();

    return Array.from({length: 6}, (_, index) => {
      const ratio = index / 5;
      const date = new Date(beginTime + duration * ratio);

      return {
        ratio,
        label: formatTimelineLabel(date, !sameDay),
      };
    });
  }, [queryRange]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return timelineLogs
      .filter(log => {
      const timestamp = getLogDate(log);
      if (timestamp < brushedRange.begin || timestamp > brushedRange.end) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const fnName = (functionNameMap[log.function] ?? log.function).toLowerCase();
      const handler = (handlerNameMap[log.function] ?? "default").toLowerCase();
      const content = log.content.toLowerCase();
      const severity = (LOG_LEVEL_LABELS[log.level] ?? "").toLowerCase();
      const formattedTimestamp = formatRowTimestamp(log).toLowerCase();

      return (
        fnName.includes(normalizedSearch) ||
        handler.includes(normalizedSearch) ||
        content.includes(normalizedSearch) ||
        severity.includes(normalizedSearch) ||
        formattedTimestamp.includes(normalizedSearch)
      );
    })
      .sort((left, right) => {
        const delta = getLogDate(left).getTime() - getLogDate(right).getTime();
        return sortDirection === "asc" ? delta : -delta;
      });
  }, [brushedRange.begin, brushedRange.end, functionNameMap, handlerNameMap, searchQuery, sortDirection, timelineLogs]);

  const handleApplyFilter = useCallback(() => {
    const nextBegin = new Date(draftBegin);
    const nextEnd = new Date(draftEnd);
    if (Number.isNaN(nextBegin.getTime()) || Number.isNaN(nextEnd.getTime()) || nextBegin > nextEnd) {
      return;
    }

    setActiveFunctionIds(draftFunctionIds);

    setQueryRange({begin: nextBegin, end: nextEnd});
    setBrushRange(DEFAULT_BRUSH_RANGE);
    setExpandedLogIds([]);
    setIsFilterOpen(false);
  }, [draftBegin, draftEnd, draftFunctionIds, setQueryRange, setBrushRange, setExpandedLogIds, setIsFilterOpen]);

  const handleClearLogs = useCallback(async () => {
    const targets = activeFunctionIds.length > 0 ? activeFunctionIds : functionItems.map(item => item.id);
    await Promise.all(
      targets.map(functionId =>
        clearFunctionLogs({
          functionId,
          begin: queryRange.begin.toISOString(),
          end: queryRange.end.toISOString(),
        })
      )
    );
    refetch();
  }, [activeFunctionIds, clearFunctionLogs, functionItems, queryRange.begin, queryRange.end, refetch]);

  const shiftBrush = useCallback((direction: -1 | 1) => {
    const width = brushRange.endRatio - brushRange.startRatio;
    if (width >= 1) {
      return;
    }

    const step = 0.1;
    const startRatio = clampRatio(Math.min(1 - width, Math.max(0, brushRange.startRatio + direction * step)));
    setBrushRange({startRatio, endRatio: startRatio + width});
  }, [brushRange.endRatio, brushRange.startRatio]);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={`${styles.toolDate} ${styles.toolDateStatic}`}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <span className={styles.toolDateValue}>{formatToolbarDate(queryRange.begin)} - {formatToolbarDate(queryRange.end)}</span>
        </div>
        <div className={styles.toolbarTools}>
          <Popover
            open={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            placement="bottomEnd"
            containerProps={{className: styles.filterAnchor}}
            contentProps={{
              style: {
                padding: 0,
                background: "transparent",
                boxShadow: "none",
                border: "none",
              },
            }}
            content={
              <div className={styles.filterPanel}>
                <div className={styles.filterTitle}>Filter Logs</div>
                <label className={styles.filterRow}>
                  <span className={styles.filterLabel}>From</span>
                  <input className={styles.filterInput} type="datetime-local" value={draftBegin} onChange={event => setDraftBegin(event.target.value)} />
                </label>
                <label className={styles.filterRow}>
                  <span className={styles.filterLabel}>To</span>
                  <input className={styles.filterInput} type="datetime-local" value={draftEnd} onChange={event => setDraftEnd(event.target.value)} />
                </label>
                <label className={styles.filterRow}>
                  <span className={styles.filterLabel}>Function</span>
                  <Select
                    options={functionOptions}
                    value={draftFunctionIds}
                    placeholder="All functions..."
                    onChange={value => setDraftFunctionIds(Array.isArray(value) ? (value as string[]) : [])}
                    multiple
                    dimensionX="fill"
                  />
                </label>
                <div className={styles.filterActions}>
                  <button type="button" className={styles.filterReset} onClick={handleReset}>Reset</button>
                  <button type="button" className={styles.filterApply} onClick={handleApplyFilter}>Apply</button>
                </div>
              </div>
            }
          >
            <button type="button" className={`${styles.filterButton} ${isFilterApplied ? styles.filterButtonActive : ""}`} onClick={handleFilterToggle}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
              Filter
            </button>
          </Popover>
        </div>
      </div>

      <div className={styles.timelineSection}>
        <div className={styles.timelineHeader}>
          <span className={styles.timelineTitle}>Timeline</span>
          <div className={styles.timelineNav}>
            <button type="button" className={styles.navButton} onClick={() => shiftBrush(-1)}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button type="button" className={styles.navButton} onClick={() => shiftBrush(1)}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        </div>

        <div ref={chartTrackRef} className={styles.chartTrack} onPointerDown={handleChartPointerDown}>
          <div className={styles.chartGrid}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.chartBars}>
            {chartBuckets.map(bucket => {
              const active = bucket.ratio >= brushRange.startRatio && bucket.ratio <= brushRange.endRatio;
              const height = `${Math.max(4, (bucket.count / maxBucketCount) * 96)}px`;

              return (
                <div key={bucket.index} className={styles.chartBarColumn}>
                  <div className={`${styles.chartBar} ${active ? styles.chartBarActive : ""}`} style={{height}} />
                </div>
              );
            })}
          </div>
          <div
            className={styles.brushOverlay}
            style={{left: `${brushRange.startRatio * 100}%`, width: `${(brushRange.endRatio - brushRange.startRatio) * 100}%`}}
          >
            <span className={styles.brushHandle} />
            <span className={styles.brushHandle} />
          </div>
        </div>

        <div className={styles.timeLabels}>
          {timeLabels.map(item => (
            <span key={item.ratio} className={styles.timeLabel} style={{left: `${item.ratio * 100}%`}}>
              {item.label}
            </span>
          ))}
        </div>

        <div className={styles.brushRange}>
          <span className={styles.brushLabel}>{formatTimelineLabel(brushedRange.begin, true)}</span>
          <span className={styles.brushHint}>drag to select range</span>
          <span className={styles.brushLabel}>{formatTimelineLabel(brushedRange.end, true)}</span>
        </div>
      </div>

      <div className={styles.logSection}>
        <div className={styles.logToolbar}>
          <label className={styles.logSearch}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input type="text" placeholder="Search logs..." value={searchQuery} onChange={event => setSearchQuery(event.target.value)} />
          </label>
          <div className={styles.severityChips}>
            {SEVERITY_CHIPS.map(chip => {
              const selected = severityFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  className={`${styles.severityChip} ${SEVERITY_CLASS[chip.key]} ${selected ? styles.severityChipSelected : ""}`}
                  onClick={() => setSeverityFilter(chip.key)}
                >
                  {chip.dotLabel && <span className={styles.severityDot}>{chip.dotLabel}</span>}
                  {chip.label}
                </button>
              );
            })}
          </div>
          <button type="button" className={styles.tableAction} onClick={() => refetch()} disabled={isFetching}>
            Refresh
          </button>
          <button type="button" className={styles.tableAction} onClick={handleClearLogs} disabled={isClearingLogs || functionItems.length === 0}>
            Clear
          </button>
          <div className={styles.logCount}><strong>{filteredLogs.length}</strong> results</div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.expandColumn} />
                <th className={styles.severityColumn}>Sev</th>
                <th>
                  <button type="button" className={styles.sortButton} onClick={() => setSortDirection(current => current === "asc" ? "desc" : "asc")}>
                    Timestamp
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{transform: sortDirection === "asc" ? "rotate(180deg)" : "none"}}><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                </th>
                <th>Function</th>
                <th>Handler</th>
                <th>Content</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className={styles.emptyState}>
                      <svg className={styles.emptyIcon} width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                      <span>{isFetching ? "Loading logs..." : "No logs match your filters"}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const fnName = functionNameMap[log.function] ?? log.function;
                  const handlerName = handlerNameMap[log.function] ?? "default";
                  const severity = getSeverityFilter(log.level);
                  const expanded = expandedLogIds.includes(log._id);

                  return (
                    <Fragment key={log._id}>
                      <tr className={expanded ? styles.rowExpanded : undefined} onClick={() => toggleRow(log._id)}>
                        <td className={styles.expandColumn}>
                          <button type="button" className={styles.expandButton} onClick={event => { event.stopPropagation(); toggleRow(log._id); }}>
                            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{transform: expanded ? "rotate(90deg)" : "none"}}><polyline points="9 18 15 12 9 6" /></svg>
                          </button>
                        </td>
                        <td className={styles.severityColumn}>
                          <span className={`${styles.severityBadge} ${SEVERITY_CLASS[severity]}`}>{getSeverityBadge(log.level)}</span>
                        </td>
                        <td className={styles.timestampCell}>{formatRowTimestamp(log)}</td>
                        <td><span className={styles.functionBadge}>{fnName}</span></td>
                        <td><span className={styles.handlerBadge}>{handlerName}</span></td>
                        <td className={styles.contentCell}>{log.content}</td>
                      </tr>
                      {expanded && (
                        <tr className={styles.detailRow}>
                          <td colSpan={6}>
                            <div className={styles.detailBody}>
                              <div className={styles.detailMeta}>
                                <div className={styles.detailMetaItem}><span className={styles.detailMetaLabel}>Event ID</span><span className={styles.detailMetaValue}>{log.event_id || "n/a"}</span></div>
                                <div className={styles.detailMetaItem}><span className={styles.detailMetaLabel}>Channel</span><span className={styles.detailMetaValue}>{log.channel}</span></div>
                                <div className={styles.detailMetaItem}><span className={styles.detailMetaLabel}>Severity</span><span className={styles.detailMetaValue}>{LOG_LEVEL_LABELS[log.level] ?? "Unknown"}</span></div>
                              </div>
                              <pre className={styles.detailJson}>
                                {JSON.stringify(
                                  {
                                    _id: log._id,
                                    function: log.function,
                                    function_name: fnName,
                                    handler: handlerName,
                                    event_id: log.event_id,
                                    channel: log.channel,
                                    level: log.level,
                                    content: log.content,
                                    created_at: log.created_at || getLogDate(log).toISOString(),
                                  },
                                  null,
                                  2
                                )}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FunctionLogPage;
