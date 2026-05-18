import React, {memo, useMemo, useState} from "react";
import styles from "../bucket-action-bar/BucketActionBar.module.scss";
import localStyles from "./ObservabilityActionBar.module.scss";
import {Button, Icon, Popover} from "oziko-ui-kit";
import ProfilerFilter from "../profiler-filter/ProfilerFilter";
import {
  createProfilerFilterDefaultValues,
  isDefaultProfilerFilter,
  type ProfilerFilterValues,
} from "../../../utils/profilerFilter";

type ObservabilityActionBarProps = {
  title: string;
  subtitle: string;
  filter: ProfilerFilterValues;
  isFetching?: boolean;
  onFilterChange: (filter: ProfilerFilterValues) => void;
  onRefetch: () => void;
  children?: React.ReactNode;
};

const ObservabilityActionBar = ({
  title,
  subtitle,
  filter,
  isFetching,
  onFilterChange,
  onRefetch,
  children,
}: ObservabilityActionBarProps) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const hasActiveFilter = useMemo(() => !isDefaultProfilerFilter(filter), [filter]);

  return (
    <div className={styles.container}>
      {/* LEFT: title + subtitle + optional extra */}
      <div className={styles.toolbarLeft}>
        <Icon name="filterCenterFocus" size={18} />
        <span className={localStyles.title}>{title}</span>
        <span className={localStyles.subtitle}>{subtitle}</span>
        {children}
      </div>

      {/* RIGHT: filter + refresh */}
      <div className={styles.toolbarRight}>
        <Popover
          open={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          placement="bottom"
          content={
            <ProfilerFilter
              initialValues={filter}
              onApply={values => {
                onFilterChange(values);
                setIsFilterOpen(false);
              }}
              onCancel={() => setIsFilterOpen(false)}
            />
          }
        >
          <Button
            shape="chip"
            variant="outlined"
            color={hasActiveFilter ? "primary" : "default"}
            onClick={() => setIsFilterOpen(prev => !prev)}
          >
            <Icon name="filter" size="sm" />
            Filter
            {hasActiveFilter && <Icon name="check" size="sm" />}
          </Button>
        </Popover>

        {hasActiveFilter && (
          <Button
            shape="chip"
            variant="outlined"
            color="default"
            onClick={() => onFilterChange(createProfilerFilterDefaultValues())}
          >
            <Icon name="close" size="sm" />
            Clear Filters
          </Button>
        )}

        <Button
          shape="chip"
          variant="outlined"
          color="default"
          onClick={onRefetch}
          disabled={isFetching}
        >
          <Icon name="refresh" size={16} />
        </Button>
      </div>
    </div>
  );
};

export default memo(ObservabilityActionBar);
