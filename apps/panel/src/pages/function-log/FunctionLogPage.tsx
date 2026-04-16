/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {useCallback, useMemo, useState} from "react";
import {FlexElement, Text} from "oziko-ui-kit";
import {useGetFunctionLogsQuery, useGetFunctionsQuery} from "../../store/api/functionApi";
import type {FunctionLog} from "../../store/api/functionApi";
import FunctionLogFilter from "./FunctionLogFilter";
import FunctionLogChart from "./FunctionLogChart";
import FunctionLogList from "./FunctionLogList";
const LEVEL_LABELS: Record<number, string> = {
  0: "Debug",
  1: "Log",
  2: "Info",
  3: "Warning",
  4: "Error",
};
import styles from "./FunctionLogPage.module.scss";

function getDefaultRange(): {begin: Date; end: Date} {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const begin = new Date();
  begin.setDate(begin.getDate() - 7);
  begin.setHours(0, 0, 0, 0);
  return {begin, end};
}

const FunctionLogPage = () => {
  const [dateRange, setDateRange] = useState(getDefaultRange);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<number[]>([]);

  const {data: apiLogs} = useGetFunctionLogsQuery({
    begin: dateRange.begin.toISOString(),
    end: dateRange.end.toISOString(),
    limit: 100,
    sort: {_id: -1},
    functions: selectedFunctions.length > 0 ? selectedFunctions : undefined,
    levels: selectedLevels.length > 0 ? selectedLevels : undefined,
  });

  const {data: functions, isError: isFunctionsError} = useGetFunctionsQuery();
  const functionList = Array.isArray(functions) ? functions : functions?.data;

  const functionNameMap = useMemo<Record<string, string>>(() => {
    if (isFunctionsError || !Array.isArray(functionList) || functionList.length === 0)
      return {};
    return Object.fromEntries(functionList.map(fn => [fn._id!, fn.name]));
  }, [functionList, isFunctionsError]);

  const functionOptions = useMemo(
    () => Object.entries(functionNameMap).map(([id, name]) => ({value: id, label: name})),
    [functionNameMap]
  );

  const handlerNameMap = useMemo<Record<string, string>>(() => {
    if (isFunctionsError || !Array.isArray(functionList) || functionList.length === 0)
      return {};
    return Object.fromEntries(
      functionList.map(fn => {
        const triggers = fn.triggers;
        let handler = "default";
        if (Array.isArray(triggers) && triggers.length > 0) {
          handler = triggers[0].handler ?? "default";
        } else if (triggers && typeof triggers === "object") {
          const firstKey = Object.keys(triggers)[0];
          if (firstKey) handler = firstKey;
        }
        return [fn._id!, handler];
      })
    );
  }, [functionList, isFunctionsError]);

  const logs = useMemo<FunctionLog[]>(() => {
    return apiLogs ?? [];
  }, [apiLogs]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(log => {
      const fnName = (functionNameMap[log.function] ?? log.function).toLowerCase();
      const handler = (handlerNameMap[log.function] ?? "default").toLowerCase();
      const content = log.content.toLowerCase();
      const severity = (LEVEL_LABELS[log.level] ?? "").toLowerCase();
      const ts = Number.parseInt(log._id.substring(0, 8), 16) * 1000;
      const timestamp = new Date(ts).toLocaleString().toLowerCase();

      return (
        fnName.includes(q) ||
        handler.includes(q) ||
        content.includes(q) ||
        severity.includes(q) ||
        timestamp.includes(q)
      );
    });
  }, [logs, searchQuery, functionNameMap, handlerNameMap]);

  const handleFilterApply = useCallback(
    (begin: Date, end: Date, functions: string[], levels: number[]) => {
      setDateRange({begin, end});
      setSelectedFunctions(functions);
      setSelectedLevels(levels);
    },
    []
  );

  return (
    <FlexElement className={styles.page} dimensionX="fill" direction="vertical" gap={10}>
      <FlexElement dimensionX="fill" alignment="rightBottom" direction="horizontal">
        <FunctionLogFilter
          begin={dateRange.begin}
          end={dateRange.end}
          functionOptions={functionOptions}
          selectedFunctions={selectedFunctions}
          selectedLevels={selectedLevels}
          onApply={handleFilterApply}
        />
      </FlexElement>

      <FunctionLogChart logs={filteredLogs} begin={dateRange.begin} end={dateRange.end} />

      <FunctionLogList
        logs={filteredLogs}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        functionNames={functionNameMap}
        handlerNames={handlerNameMap}
      />
    </FlexElement>
  );
};

export default FunctionLogPage;
