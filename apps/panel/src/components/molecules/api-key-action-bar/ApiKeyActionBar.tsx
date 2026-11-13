import React, {memo, useState, useCallback, useEffect, useMemo} from "react";
import styles from "../bucket-action-bar/BucketActionBar.module.scss";
import {Button, Icon} from "oziko-ui-kit";
import SearchBar from "../../atoms/search-bar/SearchBar";
import debounce from "lodash/debounce";

const SEARCH_DEBOUNCE_TIME = 500;

type ApiKeyActionBarProps = {
  onSearch: (value: string) => void;
  onNewApiKey: () => void;
};

const ApiKeyActionBar = ({onSearch, onNewApiKey}: ApiKeyActionBarProps) => {
  const [searchValue, setSearchValue] = useState("");

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
      </div>

      {/* RIGHT: actions */}
      <div className={styles.toolbarRight}>
        <div className={styles.newEntryWrapper}>
          <Button onClick={onNewApiKey}>
            <Icon name="plus" />
            New API Key
          </Button>
        </div>
      </div>
    </div>
  );
};

export default memo(ApiKeyActionBar);
