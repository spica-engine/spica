import {useCallback, useMemo, useState} from "react";
import {SEVERITY_LEVEL_MAP, type SeverityFilter} from "../utils/functionLogLevels";
import {formatDateTimeLocal, getDefaultRange, isSameDayRange, type DateRange} from "../utils/functionLogUtils";

type UseFunctionLogFilterStateOptions = {
  onSyncDrafts?: () => void;
  onReset?: () => void;
};

const useFunctionLogFilterState = ({onSyncDrafts, onReset}: UseFunctionLogFilterStateOptions = {}) => {
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [queryRange, setQueryRange] = useState<DateRange>(defaultRange);
  const [draftBegin, setDraftBegin] = useState(() => formatDateTimeLocal(defaultRange.begin));
  const [draftEnd, setDraftEnd] = useState(() => formatDateTimeLocal(defaultRange.end));
  const [searchQuery, setSearchQuery] = useState("");
  const [handlerFilter, setHandlerFilter] = useState("");
  const [draftHandlerFilter, setDraftHandlerFilter] = useState("");
  const [severityFilters, setSeverityFilters] = useState<SeverityFilter[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<string[]>([]);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const toggleSeverityFilter = useCallback((key: SeverityFilter) => {
    if (key === "all") {
      setSeverityFilters([]);
    } else {
      setSeverityFilters(current =>
        current.includes(key) ? current.filter(f => f !== key) : [...current, key]
      );
    }
  }, []);

  const selectedLevels =
    severityFilters.length === 0
      ? undefined
      : severityFilters.flatMap(f => SEVERITY_LEVEL_MAP[f]);

  const syncFilterDrafts = useCallback(() => {
    setDraftBegin(formatDateTimeLocal(queryRange.begin));
    setDraftEnd(formatDateTimeLocal(queryRange.end));
    setDraftHandlerFilter(handlerFilter);
    onSyncDrafts?.();
  }, [handlerFilter, onSyncDrafts, queryRange.begin, queryRange.end]);

  const handleFilterToggle = useCallback(() => {
    if (!isFilterOpen) {
      syncFilterDrafts();
    }

    setIsFilterOpen(current => !current);
  }, [isFilterOpen, syncFilterDrafts]);

  const handleReset = useCallback(() => {
    const nextRange = getDefaultRange();
    setQueryRange(nextRange);
    setDraftBegin(formatDateTimeLocal(nextRange.begin));
    setDraftEnd(formatDateTimeLocal(nextRange.end));
    setSearchQuery("");
    setHandlerFilter("");
    setDraftHandlerFilter("");
    setSeverityFilters([]);
    setSortDirection("desc");
    setExpandedLogIds([]);
    setIsFilterOpen(false);
    onReset?.();
  }, [onReset]);

  const isFilterApplied = useMemo(
    () => severityFilters.length > 0 || handlerFilter.trim() !== "" || !isSameDayRange(queryRange, defaultRange),
    [defaultRange, handlerFilter, queryRange, severityFilters]
  );

  const toggleRow = useCallback((logId: string) => {
    setExpandedLogIds(current =>
      current.includes(logId) ? current.filter(item => item !== logId) : [...current, logId]
    );
  }, []);

  return {
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
    setHandlerFilter,
    draftHandlerFilter,
    setDraftHandlerFilter,
    severityFilters,
    toggleSeverityFilter,
    selectedLevels,
    isFilterOpen,
    setIsFilterOpen,
    expandedLogIds,
    setExpandedLogIds,
    sortDirection,
    setSortDirection,
    syncFilterDrafts,
    handleFilterToggle,
    handleReset,
    isFilterApplied,
    toggleRow,
  };
};

export default useFunctionLogFilterState;
