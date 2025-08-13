import React, {memo, useState, useCallback, useEffect, useMemo} from "react";
import styles from "./BucketActionBar.module.scss";
import {Button, FlexElement, Icon} from "oziko-ui-kit";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";
import debounce from "lodash/debounce";
import BucketMorePopup from "../bucket-more-popup/BucketMorePopup";
import type { BucketType } from "src/services/bucketService";

type BucketActionBarProps = {
  onSearch: (search: string) => void;
  bucket: BucketType;
  searchLoading?: boolean;
};

const SEARCH_DEBOUNCE_TIME = 1000;

const BucketActionBar = ({onSearch, bucket, searchLoading}: BucketActionBarProps) => {
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
        <Button variant="text" onClick={() => {}}>
          <Icon name="refresh" />
          Refresh
        </Button>
        <Button variant="text" onClick={() => {}}>
          <Icon name="eye" />
          Column
        </Button>
        <BucketMorePopup bucket={bucket} />
      </FlexElement>
    </div>
  );
};

export default memo(BucketActionBar);
