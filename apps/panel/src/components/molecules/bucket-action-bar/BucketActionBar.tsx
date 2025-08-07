import React, {memo, useState, useCallback, useEffect, useMemo} from "react";
import styles from "./BucketActionBar.module.scss";
import {Button, FlexElement, Icon} from "oziko-ui-kit";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";
import debounce from "lodash/debounce";

type BucketActionBarProps = {
  onSearch: (search: string) => void;
  bucketId: string;
  searchLoading?: boolean;
};

const SEARCH_DEBOUNCE_TIME = 1000;

const BucketActionBar = ({onSearch, bucketId, searchLoading}: BucketActionBarProps) => {
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
      <FlexElement>
        <Button onClick={() => {}}>
          <Icon name="plus" />
          New Entry
        </Button>
        <Button color="default" onClick={() => {}}>
          <Icon name="refresh" />
          Refresh
        </Button>
        <Button color="default" onClick={() => {}}>
          <Icon name="eye" />
          Column
        </Button>
        <Button color="default" onClick={() => {}}>
          <Icon name="dotsVertical" />
          More
        </Button>
      </FlexElement>
    </div>
  );
};

export default memo(BucketActionBar);
