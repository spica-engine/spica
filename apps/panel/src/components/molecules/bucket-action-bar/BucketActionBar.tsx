import React, {memo, useCallback, useMemo} from "react";
import styles from "./BucketActionBar.module.scss";
import {Button, Checkbox, FlexElement, Icon, Popover} from "oziko-ui-kit";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";
import type {ColumnType} from "../../../components/organisms/bucket-table/BucketTable";
import useLocalStorage from "../../../hooks/useLocalStorage";

const BucketActionBar = ({columns, bucketId}: {columns: ColumnType[]; bucketId: string}) => {
  const defaultVisibleColumns = useMemo(
    () => Object.fromEntries(columns.map(col => [col.key, true])),
    []
  );

  const [visibleColumns, setVisibleColumns] = useLocalStorage(
    `${bucketId}-visible-columns`,
    defaultVisibleColumns
  );

  const toggleColumn = useCallback(
    (key: string) => {
      setVisibleColumns({...visibleColumns, [key]: !visibleColumns[key]});
    },
    [visibleColumns]
  );

  return (
    <div className={styles.container}>
      <SearchBar />
      <FlexElement>
        <Button onClick={() => {}}>
          <Icon name="plus" />
          New Entry
        </Button>
        <Button color="default" onClick={() => {}}>
          <Icon name="refresh" />
          Refresh
        </Button>
        <Popover
          content={
            <div>
              {columns.map(col => (
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
          <Button color="default" onClick={() => {}}>
            <Icon name="eye" />
            Column
          </Button>
        </Popover>
        <Button color="default" onClick={() => {}}>
          <Icon name="dotsVertical" />
          More
        </Button>
      </FlexElement>
    </div>
  );
};

export default memo(BucketActionBar);
