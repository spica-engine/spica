/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, {useState, useCallback} from "react";
import {Link} from "react-router-dom";
import {FlexElement, Table, type TableColumn} from "oziko-ui-kit";
import {useGetActivitiesQuery, type Activity, type ActivityOptions} from "../../store/api";
import {
  formatActivityAction,
  formatActivityResourceDisplay,
  formatActivityModule,
  buildActivityLink,
  titleCase
} from "./activityUtils";
import ActivityActionBar from "../../components/molecules/activity-action-bar/ActivityActionBar";
import styles from "./Activities.module.scss";
import sharedStyles from "../shared/EntityPage.module.scss";
import bucketStyles from "../bucket/Bucket.module.scss";

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
  const [appliedFilter, setAppliedFilter] = useState<Record<string, any> | null>(null);
  const [filterOptions, setFilterOptions] = useState<ActivityOptions>(DEFAULT_OPTIONS);

  const {data: activities = [], isLoading} = useGetActivitiesQuery(
    appliedFilter ? {...filterOptions, filter: appliedFilter} : filterOptions
  );

  const handleFilter = useCallback((filter: Record<string, any> | null) => {
    setAppliedFilter(filter);
  }, []);

  return (
    <div className={bucketStyles.container}>
      <ActivityActionBar onFilter={handleFilter} />
      <div className={sharedStyles.scrollContainer}>
        <Table
          columns={ACTIVITY_COLUMNS}
          data={activities}
          loading={isLoading}
          skeletonRowCount={10}
          fixedColumns={["_id"]}
          emptyState={{
            title: "No activities found",
            description: "There are no activities to show.",
          }}
        />
      </div>
    </div>
  );
};

export default Activities;
