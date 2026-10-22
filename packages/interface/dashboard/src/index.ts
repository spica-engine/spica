import {Id} from "@spica-server/interface-data";

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

export interface DashboardRepository {
  findAll(): Promise<Dashboard[]>;
  findById(id: Id): Promise<Dashboard | null>;
  insert(dashboard: Dashboard): Promise<Dashboard>;
  /**
   * Resolves to the replaced dashboard, or null when there is none with the id.
   */
  replaceById(id: Id, dashboard: Dashboard): Promise<Dashboard | null>;
  /**
   * Resolves to the deleted dashboard, or null when there is none with the id.
   */
  deleteById(id: Id): Promise<Dashboard | null>;
}

export const DASHBOARD_REPOSITORY = Symbol.for("DASHBOARD_REPOSITORY");
