import React, {memo, useState, useRef, useCallback, useEffect} from "react";
import styles from "./BucketActionBar.module.scss";
import {Button, FlexElement, Icon} from "oziko-ui-kit";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";

type BucketActionBarProps = {
  search: (search: string) => void;
  bucketId: string;
};

const SEARCH_DEBOUNCE_TIME = 300;

const BucketActionBar = ({search, bucketId}: BucketActionBarProps) => {
  const [searchValue, setSearchValue] = useState("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => setSearchValue(""), [bucketId]);

  const triggerSearch = useCallback(
    (value: string) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        search(value.trim());
        timerRef.current = null;
      }, SEARCH_DEBOUNCE_TIME);
    },
    [search]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    triggerSearch(value);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        search(searchValue.trim());
      }
    },
    [search, searchValue]
  );

  return (
    <div className={styles.container}>
      <SearchBar
        inputProps={{
          onKeyDown: handleKeyDown,
          value: searchValue,
          onChange: handleChange
        }}
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
