import {Dashboard, DashboardRepository} from "@spica-server/interface-dashboard";
import {NotFoundException} from "@nestjs/common";
import {ids, idOf, assignId, omitId} from "@spica-server/data";
import {CollectionQueryFacade, Id, ResourceFilterSpec} from "@spica-server/interface-data";

const dashboardIds = () => ids().forCollection("dashboard");

export function find(
  queries: CollectionQueryFacade,
  resourceFilter: ResourceFilterSpec
): Promise<Dashboard[]> {
  return queries.find<Dashboard>("dashboard", {resourceFilter});
}

export function findOne(dashboards: DashboardRepository, id: Id): Promise<Dashboard> {
  return dashboards.findById(id);
}

export async function insert(dashboards: DashboardRepository, dashboard: Dashboard) {
  if (idOf(dashboard)) {
    assignId(dashboard, dashboardIds().parse(idOf(dashboard)));
  }
  return dashboards.insert(dashboard);
}

export async function replace(dashboards: DashboardRepository, dashboard: Dashboard) {
  const id = dashboardIds().parse(idOf(dashboard));

  const currentDashboard = await dashboards.replaceById(id, omitId(dashboard));

  if (!currentDashboard) {
    throw new NotFoundException(`Dashboard with ID ${id} not found`);
  }
  return currentDashboard;
}

export async function remove(dashboards: DashboardRepository, id: string | Id) {
  const res = await dashboards.deleteById(dashboardIds().parse(id));
  if (!res) {
    throw new NotFoundException(`Dashboard with ID ${id} not found`);
  }
}
