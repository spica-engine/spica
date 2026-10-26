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
