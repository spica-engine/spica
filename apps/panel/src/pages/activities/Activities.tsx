/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {useState, useCallback} from "react";
import {Link} from "react-router-dom";
import {Button, FlexElement, Icon, type TableColumn} from "oziko-ui-kit";
import SpicaTable from "../../components/organisms/table/Table";
import {useGetActivitiesQuery, type Activity, type ActivityOptions} from "../../store/api";
import {
  formatActivityAction,
  formatActivityResourceDisplay,
  formatActivityModule,
  buildActivityLink,
  titleCase
} from "./activityUtils";
import ActivityFilterPopover from "./ActivityFilterPopover";
import styles from "./Activities.module.scss";

const DEFAULT_OPTIONS: ActivityOptions = { limit: 20, skip: 0 };

function createActivityColumns(
  resourceLinkClassName: string
): TableColumn<Activity>[] {
  return [
    {
      header: <FlexElement>#</FlexElement>,
      key: "_id",
      width: "250px",
      minWidth: "250px",
      renderCell: ({row}) => <span>{row._id}</span>
    },
    {
      header: <FlexElement>Identifier</FlexElement>,
      key: "identifier",
      width: "200px",
      minWidth: "200px",
      renderCell: ({row}) => (
        <span>{row.identifier ? titleCase(String(row.identifier)) : "-"}</span>
      )
    },
    {
      header: <FlexElement>Action</FlexElement>,
      key: "action",
      width: "90px",
      minWidth: "90px",
      renderCell: ({row}) => <span>{formatActivityAction(row.action)}</span>
    },
    {
      header: <FlexElement>Resource</FlexElement>,
      key: "resource",
      width: "450px",
      minWidth: "450px",
      renderCell: ({row}) => {
        const link = buildActivityLink(row);
        const displayText = formatActivityResourceDisplay(row.resource);
        const moduleText = formatActivityModule(row.resource);

        if (link) {
          return (
            <FlexElement dimensionX="fill" alignment="leftCenter" direction="horizontal" gap={4}>
              <Link to={`/${link}`} className={resourceLinkClassName}>
                <span className={styles.link}>
                  {displayText} on {moduleText} module.
                </span>
              </Link>
            </FlexElement>
          );
        }

        return (
          <span>
            {displayText} on {moduleText} module.
          </span>
        );
      }
    },
    {
      header: <FlexElement>Created</FlexElement>,
      key: "created_at",
      width: "180px",
      minWidth: "180px",
      renderCell: ({row}) => (
        <span>
          {row.created_at
            ? new Date(row.created_at).toLocaleString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
              })
            : "-"}
        </span>
      )
    }
  ];
}

const ACTIVITY_COLUMNS = createActivityColumns(styles.resourceLink);

const Activities = () => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState<ActivityOptions>(DEFAULT_OPTIONS);

  const {data: activities = [], isLoading} = useGetActivitiesQuery(filterOptions);

  const handleApplyFilter = useCallback((options: ActivityOptions) => {
    setFilterOptions(options);
    setIsFilterOpen(false);
  }, []);

  const handleToggleFilter = useCallback(() => {
    setIsFilterOpen((prev) => !prev);
  }, []);

  const handleCloseFilter = useCallback(() => setIsFilterOpen(false), []);

  const columns = ACTIVITY_COLUMNS;

  return (
    <div className={styles.activities}>
      <FlexElement dimensionX="fill" alignment="rightCenter">
        <ActivityFilterPopover
          open={isFilterOpen}
          onClose={handleCloseFilter}
          onApply={handleApplyFilter}
        >
          <Button onClick={handleToggleFilter}>
            <Icon name="filter" />
            Filter
          </Button>
        </ActivityFilterPopover>
      </FlexElement>
      <div className={styles.tableContainer}>
        <SpicaTable
          columns={columns}
          data={activities}
          isLoading={isLoading}
          skeletonRowCount={10}
          fixedColumns={["_id"]}
          tableClassName={styles.table}
        />
        {!isLoading && activities.length === 0 ? (
          <div className={styles.emptyState}>There is no activities to show</div>
        ) : null}
      </div>
    
    </div>
  );
};

export default Activities;
