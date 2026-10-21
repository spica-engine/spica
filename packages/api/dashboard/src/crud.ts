import {ReturnDocument} from "@spica-server/database";
import {DashboardService} from "./dashboard.service.js";
import {Dashboard} from "@spica-server/interface-dashboard";
import {NotFoundException} from "@nestjs/common";
import {ids} from "@spica-server/data";
import {CollectionQueryFacade, Id} from "@spica-server/interface-data";

const dashboardIds = () => ids().forCollection("dashboard");

export function find(queries: CollectionQueryFacade, resourceFilter: object): Promise<Dashboard[]> {
  return queries.find<Dashboard>("dashboard", {resourceFilter});
}

export function findOne(ds: DashboardService, id: Id): Promise<Dashboard> {
  return ds.findOne({_id: id});
}

export async function insert(ds: DashboardService, dashboard: Dashboard) {
  if (dashboard._id) {
    dashboard._id = dashboardIds().parse(dashboard._id);
  }
  await ds.insertOne(dashboard);
  return dashboard;
}

export async function replace(ds: DashboardService, dashboard: Dashboard) {
  const _id = dashboardIds().parse(dashboard._id);
  const {_id: _, ...dashboardWithoutId} = dashboard;

  const currentDashboard = await ds.findOneAndReplace({_id}, dashboardWithoutId, {
    returnDocument: ReturnDocument.AFTER
  });

  if (!currentDashboard) {
    throw new NotFoundException(`Dashboard with ID ${_id} not found`);
  }
  return currentDashboard;
}

export async function remove(ds: DashboardService, id: string | Id) {
  const res = await ds.findOneAndDelete({_id: dashboardIds().parse(id)});
  if (!res) {
    throw new NotFoundException(`Dashboard with ID ${id} not found`);
  }
}
