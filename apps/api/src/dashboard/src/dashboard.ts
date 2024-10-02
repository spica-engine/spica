import {ObjectId} from "@spica-server/database";

export interface Dashboard {
  _id?: ObjectId;
  name: string;
  icon: string;
  components: Component[];
}

export interface Component {
  name: string;
  url: string;
  type: string;
  ratio: string;
}
