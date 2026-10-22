import {Dashboard, DashboardRepository} from "@spica-server/interface-dashboard";
import {NotFoundException} from "@nestjs/common";
import {ids} from "@spica-server/data";
import {CollectionQueryFacade, Id} from "@spica-server/interface-data";

const dashboardIds = () => ids().forCollection("dashboard");

export function find(queries: CollectionQueryFacade, resourceFilter: object): Promise<Dashboard[]> {
  return queries.find<Dashboard>("dashboard", {resourceFilter});
}

export function findOne(dashboards: DashboardRepository, id: Id): Promise<Dashboard> {
  return dashboards.findById(id);
}

export async function insert(dashboards: DashboardRepository, dashboard: Dashboard) {
  if (dashboard._id) {
    dashboard._id = dashboardIds().parse(dashboard._id);
  }
  await dashboards.insert(dashboard);
  return dashboard;
}

export async function replace(dashboards: DashboardRepository, dashboard: Dashboard) {
  const _id = dashboardIds().parse(dashboard._id);
  const {_id: _, ...dashboardWithoutId} = dashboard;

  const currentDashboard = await dashboards.replaceById(_id, dashboardWithoutId);

  if (!currentDashboard) {
    throw new NotFoundException(`Dashboard with ID ${_id} not found`);
  }
  return currentDashboard;
}

export async function remove(dashboards: DashboardRepository, id: string | Id) {
  const res = await dashboards.deleteById(dashboardIds().parse(id));
  if (!res) {
    throw new NotFoundException(`Dashboard with ID ${id} not found`);
  }
}
