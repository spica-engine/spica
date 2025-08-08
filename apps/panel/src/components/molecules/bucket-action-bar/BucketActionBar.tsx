import React, {memo} from "react";
import styles from "./BucketActionBar.module.scss";
import {Button, FlexElement, Icon, Popover, Checkbox} from "oziko-ui-kit";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";
import type {ColumnType} from "src/components/organisms/bucket-table/BucketTable";

type BucketActionBarProps = {
  columns: ColumnType[];
  visibleColumns: Record<string, boolean>;
  toggleColumn: (key?: string) => void;
};
const BucketActionBar = ({columns, visibleColumns, toggleColumn}: BucketActionBarProps) => {
  return (
    <div className={styles.container}>
      <SearchBar />
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
