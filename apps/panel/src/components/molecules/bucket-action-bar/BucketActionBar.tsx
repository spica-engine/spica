import React, {memo, useState, useCallback, useEffect, useMemo} from "react";
import styles from "./BucketActionBar.module.scss";
import {Button, FlexElement, Icon, Popover, Checkbox} from "oziko-ui-kit";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";
import debounce from "lodash/debounce";
import type {ColumnType} from "../../../components/organisms/bucket-table/BucketTable";

type BucketActionBarProps = {
  onSearch: (search: string) => void;
  bucketId: string;
  searchLoading?: boolean;
  columns: ColumnType[];
  visibleColumns: Record<string, boolean>;
  toggleColumn: (key?: string) => void;
};

const SEARCH_DEBOUNCE_TIME = 1000;

const BucketActionBar = ({
  onSearch,
  bucketId,
  searchLoading,
  columns,
  visibleColumns,
  toggleColumn
}: BucketActionBarProps) => {
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => setSearchValue(""), [bucketId]);

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        onSearch(value);
      }, SEARCH_DEBOUNCE_TIME),
    [onSearch]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trimStart();
    setSearchValue(value);
  };

  useEffect(() => {
    debouncedSearch(searchValue);
  }, [searchValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        debouncedSearch.flush();
      }
    },
    [debouncedSearch]
  );

  return (
    <div className={styles.container}>
      <SearchBar
        inputProps={{
          onKeyDown: handleKeyDown,
          value: searchValue,
          onChange: handleSearchInputChange
        }}
        loading={searchLoading}
      />
      <FlexElement className={styles.actionBar}>
        <Button onClick={() => {}}>
          <Icon name="plus" />
          New Entry
        </Button>
        <Button variant="text" onClick={() => {}}>
          <Icon name="refresh" />
          Refresh
        </Button>
        <Popover
          contentProps={{
            className: styles.columnsPopoverContent
          }}
          content={
            <div>
              <Checkbox
                label="Display All"
                checked={Object.values(visibleColumns).every(v => v)}
                onChange={() => toggleColumn()}
                className={styles.displayAllCheckbox}
              />
              {columns.slice(1).map(col => (
                <Checkbox
                  key={col.key}
                  label={col.header}
                  checked={visibleColumns[col.key]}
                  onChange={() => toggleColumn(col.key)}
                />
              ))}
            </div>
          }
        >
          <Button variant="text" onClick={() => {}}>
            <Icon name="eye" />
            Column
          </Button>
        </Popover>
        <Button variant="text" onClick={() => {}}>
          <Icon name="dotsVertical" />
          More
        </Button>
      </FlexElement>
    </div>
  );
};

export default memo(BucketActionBar);
