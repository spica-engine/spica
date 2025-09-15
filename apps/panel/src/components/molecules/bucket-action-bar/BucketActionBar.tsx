import React, {memo, useState, useCallback, useEffect, useMemo} from "react";
import styles from "./BucketActionBar.module.scss";
import {Button, FlexElement, Icon, Popover, Checkbox} from "oziko-ui-kit";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";
import debounce from "lodash/debounce";
import BucketMorePopup from "../bucket-more-popup/BucketMorePopup";
import type {BucketType} from "src/services/bucketService";
import type {ColumnType} from "../../../components/organisms/bucket-table/BucketTable";

type BucketActionBarProps = {
  onRefresh: () => void;
  onSearch: (search: string) => void;
  bucket: BucketType;
  searchLoading?: boolean;
  refreshLoading?: boolean;
  columns: ColumnType[];
  visibleColumns: Record<string, boolean>;
  toggleColumn: (key?: string) => void;
};

const SEARCH_DEBOUNCE_TIME = 1000;

const BucketActionBar = ({
  onRefresh,
  onSearch,
  bucket,
  searchLoading,
  refreshLoading,
  columns,
  visibleColumns,
  toggleColumn
}: BucketActionBarProps) => {
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => setSearchValue(""), [bucket?._id]);
  const isReadOnlyChecked = useMemo(() => bucket?.readOnly, [bucket]);

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

  const {allColumnsVisible, someColumnsVisible} = useMemo(() => {
    const {_id, ...otherColumnsVisibility} = visibleColumns;
    const otherColumnsValues = Object.values(otherColumnsVisibility);
    const allColumnsVisible = otherColumnsValues.every(isVisible => isVisible);
    const someColumnsVisible =
      !allColumnsVisible && otherColumnsValues.some(isVisible => isVisible);
    return {allColumnsVisible, someColumnsVisible};
  }, [visibleColumns]);

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
        {!isReadOnlyChecked && (
          <Button onClick={() => {}}>
            <Icon name="plus" />
            New Entry
          </Button>
        )}
        <Button
          className={styles.refreshButton}
          variant="text"
          onClick={onRefresh}
          disabled={refreshLoading || searchLoading}
          loading={refreshLoading}
        >
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
                checked={allColumnsVisible}
                indeterminate={someColumnsVisible}
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
          <Button className={styles.columnButton} variant="text" onClick={() => {}}>
            <Icon name="eye" />
            Column
          </Button>
        </Popover>
        <BucketMorePopup bucket={bucket} />
      </FlexElement>
    </div>
  );
};

export default memo(BucketActionBar);
