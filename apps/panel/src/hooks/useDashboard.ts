import { dashboardApi } from '../store/api/dashboardApi';

/**
 * useDashboard: Simplified hook that re-exports RTK Query hooks for dashboard operations.
 *
 * Usage:
 * ```tsx
 * const {
 *   useGetDashboardsQuery,
 *   useCreateDashboardMutation,
 *   // ... other hooks
 * } = useDashboard();
 *
 * // In component:
 * const { data, isLoading } = useGetDashboardsQuery();
 * const [createDashboard] = useCreateDashboardMutation();
 * ```
 */
export const useDashboard = () => {
  return {
    useGetDashboardsQuery: dashboardApi.useGetDashboardsQuery,
    useLazyGetDashboardsQuery: dashboardApi.useLazyGetDashboardsQuery,
    useGetDashboardQuery: dashboardApi.useGetDashboardQuery,
    useLazyGetDashboardQuery: dashboardApi.useLazyGetDashboardQuery,
    useCreateDashboardMutation: dashboardApi.useCreateDashboardMutation,
    useUpdateDashboardMutation: dashboardApi.useUpdateDashboardMutation,
    useDeleteDashboardMutation: dashboardApi.useDeleteDashboardMutation,
    useExecuteDashboardComponentQuery: dashboardApi.useExecuteDashboardComponentQuery,
    useLazyExecuteDashboardComponentQuery: dashboardApi.useLazyExecuteDashboardComponentQuery,

    prefetchDashboards: dashboardApi.usePrefetch('getDashboards'),
    prefetchDashboard: dashboardApi.usePrefetch('getDashboard'),

    invalidateDashboards: () => dashboardApi.util.invalidateTags(['Dashboard']),
    invalidateDashboard: (id?: string) => {
      if (id) {
        return dashboardApi.util.invalidateTags([{ type: 'Dashboard', id }]);
      }
      return dashboardApi.util.invalidateTags(['Dashboard']);
    },
  };
};

// For backward compatibility, also export the individual hooks directly
export const {
  useGetDashboardsQuery,
  useLazyGetDashboardsQuery,
  useGetDashboardQuery,
  useLazyGetDashboardQuery,
  useCreateDashboardMutation,
  useUpdateDashboardMutation,
  useDeleteDashboardMutation,
  useExecuteDashboardComponentQuery,
  useLazyExecuteDashboardComponentQuery,
} = dashboardApi;

export default useDashboard;
