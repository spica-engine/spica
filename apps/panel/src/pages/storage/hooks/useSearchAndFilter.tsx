import type {TypeFilterValue} from "oziko-ui-kit";
import {useState} from "react";
import {buildApiFilter} from "../utils";

export function useSearchAndFilter() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterValue, setFilterValue] = useState<TypeFilterValue | null>(null);
  const [apiFilter, setApiFilter] = useState<object>({});

  const isFilteringOrSearching = !!(searchQuery || filterValue);

  const handleApplyFilter = (filter: TypeFilterValue) => {
    setFilterValue(filter);
    if (!filter) {
      setApiFilter({});
      return;
    }

    const negativeFilterValue: TypeFilterValue = {
      type: ["inode/directory"],
      fileSize: { min: {value: null, unit: "bytes"},
        max: {value: null, unit: "bytes"}
      },
      quickdate: null,
      dateRange: {from: null, to: null}
    };
    const newApiFilter = buildApiFilter(filter, negativeFilterValue);
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
