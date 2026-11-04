import {
  DeletableById,
  FindableAll,
  Id,
  ReplaceableById,
  Repository
} from "@spica-server/interface-data";

export interface DashboardAsset {
  schema: Dashboard;
}

export interface Dashboard {
  _id?: Id;
  name: string;
  icon: string;
  components: Component[];
}

interface Component {
  name: string;
  url: string;
  type: string;
  ratio: string;
}

export interface DashboardRepository
  extends
    FindableAll<Dashboard>,
    Repository<Dashboard>,
    ReplaceableById<Dashboard>,
    DeletableById<Dashboard | null> {}

export const DASHBOARD_REPOSITORY = Symbol.for("DASHBOARD_REPOSITORY");
