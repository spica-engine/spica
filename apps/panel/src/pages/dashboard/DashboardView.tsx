import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useParams} from "react-router-dom";
import styles from "./DashboardView.module.scss";
import DashboardLayout from "../../components/organisms/dashboard/layout/DashboardLayout";
import AddComponentDrawer from "../../components/organisms/dashboard/add-component-drawer/AddComponentDrawer";
import {
  useGetDashboardQuery,
  useUpdateDashboardMutation,
  useLazyExecuteDashboardComponentQuery
} from "../../store/api/dashboardApi";
import type {DashboardComponent} from "../../store/api/dashboardApi";
import {getEmptyComponent} from "../../store/api/dashboardApi";

const DashboardView = () => {
  const {dashboardId} = useParams<{dashboardId: string}>();
  const {data: dashboard, isLoading} = useGetDashboardQuery(dashboardId!, {
    skip: !dashboardId
  });
  const [updateDashboard] = useUpdateDashboardMutation();
  const [executeComponent] = useLazyExecuteDashboardComponentQuery();

  // Component data map: index → fetched data
  const [componentDataMap, setComponentDataMap] = useState<Record<number, any>>({});
  const [componentLoadingMap, setComponentLoadingMap] = useState<Record<number, boolean>>({});
  const [componentErrorMap, setComponentErrorMap] = useState<Record<number, any>>({});

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const editingComponent = useMemo(() => {
    if (editingIndex === null || !dashboard?.components) return undefined;
    return dashboard.components[editingIndex];
  }, [editingIndex, dashboard?.components]);

  // Fetch component data when dashboard loads
  useEffect(() => {
    if (!dashboard?.components) return;

    dashboard.components.forEach((comp, index) => {
      if (comp.url) {
        setComponentLoadingMap(prev => ({...prev, [index]: true}));
        setComponentErrorMap(prev => ({...prev, [index]: undefined}));
        executeComponent({url: comp.url})
          .unwrap()
          .then(data => {
            setComponentDataMap(prev => ({...prev, [index]: data}));
          })
          .catch(err => {
            console.error(`Failed to fetch component ${index} data:`, err);
            setComponentErrorMap(prev => ({...prev, [index]: err}));
          })
          .finally(() => {
            setComponentLoadingMap(prev => ({...prev, [index]: false}));
          });
      }
    });
  }, [dashboard?.components, executeComponent]);

  const handleAddComponent = useCallback(() => {
    setEditingIndex(null);
    setIsDrawerOpen(true);
  }, []);

  const handleComponentSettingsClick = useCallback((index: number) => {
    setEditingIndex(index);
    setIsDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
    setEditingIndex(null);
  }, []);

  const handleSaveComponent = useCallback(
    async (component: DashboardComponent) => {
      if (!dashboard?._id) return;

      try {
        const updatedComponents = [...(dashboard.components ?? [])];

        if (editingIndex !== null) {
          updatedComponents[editingIndex] = component;
        } else {
          updatedComponents.push(component);
        }

        await updateDashboard({
          id: dashboard._id,
          body: {
            name: dashboard.name,
            icon: dashboard.icon,
            components: updatedComponents,
          }
        }).unwrap();

        setIsDrawerOpen(false);
        setEditingIndex(null);
      } catch (err) {
        console.error("Failed to save component:", err);
      }
    },
    [dashboard, editingIndex, updateDashboard]
  );

  const handleDeleteComponent = useCallback(async () => {
    if (!dashboard?._id || editingIndex === null) return;

    try {
      const updatedComponents = [...(dashboard.components ?? [])];
      updatedComponents.splice(editingIndex, 1);

      await updateDashboard({
        id: dashboard._id,
        body: {
          name: dashboard.name,
          icon: dashboard.icon,
          components: updatedComponents,
        }
      }).unwrap();

      setIsDrawerOpen(false);
      setEditingIndex(null);
    } catch (err) {
      console.error("Failed to delete component:", err);
    }
  }, [dashboard, editingIndex, updateDashboard]);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading dashboard...</div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>Dashboard not found</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <DashboardLayout
        dashboard={dashboard}
        dashboardId={dashboardId}
        componentDataMap={componentDataMap}
        componentLoadingMap={componentLoadingMap}
        componentErrorMap={componentErrorMap}
        onAddComponent={handleAddComponent}
        onComponentSettingsClick={handleComponentSettingsClick}
      />

      <AddComponentDrawer
        isOpen={isDrawerOpen}
        component={editingComponent}
        onSave={handleSaveComponent}
        onDelete={editingIndex !== null ? handleDeleteComponent : undefined}
        onClose={handleDrawerClose}
      />
    </div>
  );
};

export default DashboardView;
