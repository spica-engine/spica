import React, {memo, useState, useCallback} from "react";
import styles from "../bucket-action-bar/BucketActionBar.module.scss";
import {Button, Icon, Popover} from "oziko-ui-kit";
import FilterPanel from "../../prefabs/filter-panel/FilterPanel";
import type {FilterField} from "../../prefabs/filter-panel/types";

const ACTIVITY_FILTER_FIELDS: FilterField[] = [
  {key: "identifier", label: "Identifier", type: "string"},
  {
    key: "action",
    label: "Action",
    type: "enum",
    enumOptions: [
      {label: "Insert", value: 1},
      {label: "Update", value: 2},
      {label: "Delete", value: 3},
    ],
  },
  {key: "created_at", label: "Created At", type: "date"},
];

type ActivityActionBarProps = {
  onFilter: (filter: Record<string, any> | null) => void;
};

const ActivityActionBar = ({onFilter}: ActivityActionBarProps) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  const handleFilterApply = useCallback(
    (filter: Record<string, any> | null) => {
      setActiveFilterCount(filter ? 1 : 0);
      onFilter(filter);
    },
    [onFilter]
  );

  const handleFilterClear = useCallback(() => {
    setActiveFilterCount(0);
    onFilter(null);
  }, [onFilter]);

  return (
    <div className={styles.container}>
      {/* LEFT: filter chip */}
      <div className={styles.toolbarLeft}>
        <Popover
          open={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          placement="bottomStart"
          contentProps={{style: {padding: 0, background: 'transparent', boxShadow: 'none', border: 'none'}}}
          content={
            <FilterPanel
              fields={ACTIVITY_FILTER_FIELDS}
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

      {/* RIGHT: empty */}
      <div className={styles.toolbarRight} />
    </div>
  );
};

export default memo(ActivityActionBar);
