/**
 * Dashboard sidebar navigation prefab.
 *
 * Lists all dashboards as links, provides a context popover with
 * "Change Name" and "Delete" actions, and an "Add New Dashboard" button
 * that opens the EditDashboard modal in create mode.
 */

import React, {memo, useCallback, useMemo, useState} from "react";
import {Link, useNavigate, useParams} from "react-router-dom";
import {Icon, Popover, Text} from "oziko-ui-kit";
import styles from "../Navigation.module.scss";
import dashboardStyles from "./DashboardNavigation.module.scss";
import {
  useGetDashboardsQuery,
  useDeleteDashboardMutation
} from "../../../../store/api/dashboardApi";
import type {Dashboard} from "../../../../store/api/dashboardApi";
import EditDashboard from "../../edit-dashboard/EditDashboard";
import Confirmation from "../../../molecules/confirmation/Confirmation";

const DashboardNavigation = () => {
  const navigate = useNavigate();
  const {dashboardId: activeDashboardId} = useParams<{dashboardId: string}>();
  const [searchQuery, setSearchQuery] = useState("");

  const {data, isLoading} = useGetDashboardsQuery();
  const dashboards = data?.data ?? [];

  const filteredDashboards = useMemo(() => {
    if (!searchQuery.trim()) return dashboards;
    const q = searchQuery.toLowerCase();
    return dashboards.filter(d => d.name.toLowerCase().includes(q));
  }, [dashboards, searchQuery]);

  const [deleteDashboard, {isLoading: isDeleting}] = useDeleteDashboardMutation();
  const [deletingDashboard, setDeletingDashboard] = useState<Dashboard | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleCreated = useCallback(
    (dashboard: Dashboard) => {
      if (dashboard._id) {
        navigate(`/dashboard/${dashboard._id}`);
      }
    },
    [navigate]
  );

  const handleDeleteClick = useCallback((e: React.MouseEvent, dashboard: Dashboard) => {
    e.stopPropagation();
    e.preventDefault();
    setDeleteError(null);
    setDeletingDashboard(dashboard);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingDashboard?._id) return;
    try {
      await deleteDashboard(deletingDashboard._id).unwrap();
      setDeletingDashboard(null);

      // If we deleted the active dashboard, navigate to home
      if (deletingDashboard._id === activeDashboardId) {
        navigate("/dashboard");
      }
    } catch (err: any) {
      setDeleteError(err?.data?.message ?? err?.message ?? "Failed to delete dashboard.");
    }
  }, [deletingDashboard, deleteDashboard, activeDashboardId, navigate]);

  const handleDeleteCancel = useCallback(() => {
    setDeletingDashboard(null);
    setDeleteError(null);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.sidebarHead}>
        <div className={styles.sidebarTopRow}>
          <span className={styles.sidebarLabel}>Dashboards</span>
        </div>
        <div className={styles.searchBox}>
          <Icon name="search" size="sm" />
          <input
            placeholder="Search dashboards…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.navigationListContainer}>
        {(() => {
          if (isLoading) {
            return (
              <Text size="small" className={styles.defaultNavigationItem}>
                Loading...
              </Text>
            );
          }

          if (filteredDashboards.length === 0) {
            return (
              <Text size="small" className={styles.defaultNavigationItem}>
                {dashboards.length === 0 ? "No dashboards" : "No results"}
              </Text>
            );
          }

          return filteredDashboards.map(dashboard => {
            const isActive = dashboard._id === activeDashboardId;

            return (
              <Link
                key={dashboard._id}
                to={`/dashboard/${dashboard._id}`}
                className={`${dashboardStyles.dashboardLink} ${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
              >
                <Icon name="dashboard" size="md" />
                <span className={dashboardStyles.dashboardTitle}>{dashboard.name}</span>
                <div className={styles.navItemActions}>
                  <Popover
                    trigger="hover"
                    content={
                      <div className={dashboardStyles.popoverMenu}>
                        <EditDashboard dashboard={dashboard} mode="edit">
                          {({onOpen}) => (
                            <button
                              className={dashboardStyles.popoverMenuItem}
                              onClick={onOpen}
                            >
                              <Icon name="pencil" size="sm" />
                              <Text size="small">Change Name</Text>
                            </button>
                          )}
                        </EditDashboard>

                        <button
                          className={`${dashboardStyles.popoverMenuItem} ${dashboardStyles.danger}`}
                          onClick={e => handleDeleteClick(e, dashboard)}
                        >
                          <Icon name="delete" size="sm" />
                          <Text size="small">Delete</Text>
                        </button>
                      </div>
                    }
                  >
                    <Icon name="dotsVertical" />
                  </Popover>
                </div>
              </Link>
            );
          });
        })()}
      </div>

      <EditDashboard mode="create" onCreated={handleCreated}>
        {({onOpen}) => (
          <button onClick={onOpen} className={styles.addButton}>
            <Icon name="plus" size="sm" />
            Add New Dashboard
          </button>
        )}
      </EditDashboard>

      {deletingDashboard && (
        <Confirmation
          title="DELETE DASHBOARD"
          description={
            <>
              This action will permanently delete this dashboard and all its components. This cannot
              be undone.
              {"\n\n"}
              Please type <strong>{deletingDashboard.name}</strong> to confirm deletion.
            </>
          }
          inputPlaceholder="Type dashboard name"
          confirmLabel={
            <>
              <Icon name="delete" />
              Delete
            </>
          }
          cancelLabel={
            <>
              <Icon name="close" />
              Cancel
            </>
          }
          showInput
          confirmCondition={val => val === deletingDashboard.name}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          loading={isDeleting}
          error={deleteError}
        />
      )}
    </div>
  );
};

export default memo(DashboardNavigation);
