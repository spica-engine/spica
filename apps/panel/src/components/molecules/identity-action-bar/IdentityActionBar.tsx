import React, {memo, useState, useCallback, useEffect, useMemo} from "react";
import styles from "../../molecules/bucket-action-bar/BucketActionBar.module.scss";
import {Button, Icon, Popover} from "oziko-ui-kit";
import SearchBar from "../../atoms/search-bar/SearchBar";
import debounce from "lodash/debounce";
import FilterPanel from "../../prefabs/filter-panel/FilterPanel";
import type {FilterConditionRow, FilterField} from "../../prefabs/filter-panel/types";
import {useFilterBuilder} from "../../../hooks/useFilterBuilder";
import type {FilterInput} from "../../../utils/serializeFilter";

const SEARCH_DEBOUNCE_TIME = 500;

const IDENTITY_FILTER_FIELDS: FilterField[] = [
  {key: "identifier", label: "Identifier", type: "string"},
  {key: "failedAttempts", label: "Failed Attempts", type: "number"},
  {key: "lastLogin", label: "Last Login", type: "date"},
];

type IdentityActionBarProps = {
  onSearch: (value: string) => void;
  onNewIdentity: () => void;
  onFilter: (filter: FilterInput | null) => void;
};

const IdentityActionBar = ({onSearch, onNewIdentity, onFilter}: IdentityActionBarProps) => {
  const [searchValue, setSearchValue] = useState("");
  const buildFilter = useFilterBuilder(IDENTITY_FILTER_FIELDS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  const debouncedSearch = useMemo(
    () => debounce((value: string) => onSearch(value), SEARCH_DEBOUNCE_TIME),
    [onSearch]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trimStart();
    setSearchValue(value);
    debouncedSearch(value);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        debouncedSearch.flush();
      }
    },
    [debouncedSearch]
  );

  const handleFilterApply = useCallback(
    (_mongoFilter: Record<string, any> | null, conditions: FilterConditionRow[]) => {
      const filter = buildFilter(conditions);
      setActiveFilterCount(filter ? 1 : 0);
      onFilter(filter);
    },
    [buildFilter, onFilter]
  );

  const handleFilterClear = useCallback(() => {
    setActiveFilterCount(0);
    onFilter(null);
  }, [onFilter]);

  return (
    <div className={styles.container}>
      {/* LEFT: search */}
      <div className={styles.toolbarLeft}>
        <SearchBar
          className={styles.searchBar}
          inputProps={{
            value: searchValue,
            onChange: handleSearchChange,
            onKeyDown: handleKeyDown,
          }}
        />
        <Popover
          open={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          placement="bottomStart"
          contentProps={{style: {padding: 0, background: 'transparent', boxShadow: 'none', border: 'none'}}}
          content={
            <FilterPanel
              fields={IDENTITY_FILTER_FIELDS}
              onApply={handleFilterApply}
              onClear={handleFilterClear}
              onRequestClose={() => setIsFilterOpen(false)}
            />
          }
        >
          <Button
            shape="chip"
            variant="outlined"
            color="default"
            className={`${(isFilterOpen || activeFilterCount > 0) ? styles.chipActive : ""}`}
            onClick={() => setIsFilterOpen(prev => !prev)}
          >
            <Icon name="filter" />
            Filter
            {activeFilterCount > 0 && (
              <span className={styles.chipBadge}>{activeFilterCount}</span>
            )}
          </Button>
        </Popover>
      </div>

      {/* RIGHT: actions */}
      <div className={styles.toolbarRight}>
        <div className={styles.newEntryWrapper}>
          <Button onClick={onNewIdentity}>
            <Icon name="plus" />
            New Identity
          </Button>
        </div>
      </div>
    </div>
  );
};

export default memo(IdentityActionBar);
