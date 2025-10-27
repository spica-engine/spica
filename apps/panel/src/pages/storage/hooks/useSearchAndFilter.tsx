import type { TypeFilterValue } from "oziko-ui-kit";
import { useState } from "react";
import { buildApiFilter } from "../utils";

export function useSearchAndFilter() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterValue, setFilterValue] = useState<TypeFilterValue | null>(null);
  const [apiFilter, setApiFilter] = useState<object>({});

  const isFilteringOrSearching = !!(searchQuery || filterValue);

  const handleApplyFilter = (filter: TypeFilterValue) => {
    setFilterValue(filter);

    const newApiFilter = buildApiFilter(filter);
    setApiFilter(newApiFilter);
  };

  return {
    searchQuery,
    setSearchQuery,
    filterValue,
    setFilterValue,
    apiFilter,
    isFilteringOrSearching,
    handleApplyFilter
  };
}