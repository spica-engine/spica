import React, {memo} from "react";
import styles from "./BucketActionBar.module.scss";
import {Button, FlexElement, Icon, Popover} from "oziko-ui-kit";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";
import Checkbox from "../../../components/atoms/checkbox/Checkbox";
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
