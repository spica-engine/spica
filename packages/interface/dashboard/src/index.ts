import {ObjectId} from "bson";

export interface DashboardAsset {
  schema: Dashboard;
}

export interface Dashboard {
  _id?: ObjectId;
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
