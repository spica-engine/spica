import {ObjectId} from "@spica-server/database";

export interface Dashboard {
  _id?: string | ObjectId;
  name: string;
  icon: string;
  components: Component[];
}

export interface Component {
  name: string;
  type: string;
  url: string;
}
