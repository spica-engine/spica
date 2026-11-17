import {useCallback} from "react";
import {filterForEngine} from "../components/prefabs/filter-panel/filterPanelUtils";
import type {FilterConditionRow, FilterField} from "../components/prefabs/filter-panel/types";
import {useEngine} from "./useEngine";

export function useFilterBuilder(fields: FilterField[]) {
  const engine = useEngine();
  return useCallback(
    (conditions: FilterConditionRow[]) => filterForEngine(engine, conditions, fields),
    [engine, fields]
  );
}
