import {ObjectId, ReturnDocument} from "@spica-server/database";
import {DashboardService} from "./dashboard.service";
import {Dashboard} from "@spica-server/interface/dashboard";
import {NotFoundException} from "@nestjs/common";

export function find(ds: DashboardService, resourceFilter: object): Promise<Dashboard[]> {
  return ds.aggregate<Dashboard>([resourceFilter]).toArray();
}

export function findOne(ds: DashboardService, id: ObjectId): Promise<Dashboard> {
  return ds.findOne({_id: id});
}

export async function insert(ds: DashboardService, dashboard: Dashboard) {
  if (dashboard._id) {
    dashboard._id = new ObjectId(dashboard._id);
  }
  await ds.insertOne(dashboard);
  return dashboard;
}

export async function replace(ds: DashboardService, dashboard: Dashboard) {
  const _id = new ObjectId(dashboard._id);
  delete dashboard._id;

  const currentDashboard = await ds.findOneAndReplace({_id}, dashboard, {
    returnDocument: ReturnDocument.AFTER
  });

  if (!currentDashboard) {
    throw new NotFoundException(`Dashboard with ID ${_id} not found`);
  }
  return currentDashboard;
}

export async function remove(ds: DashboardService, id: string | ObjectId) {
  const res = await ds.findOneAndDelete({_id: new ObjectId(id)});
  if (!res) {
    throw new NotFoundException(`Dashboard with ID ${id} not found`);
  }
}
