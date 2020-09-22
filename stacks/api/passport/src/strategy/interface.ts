import {ObjectId} from "@spica-server/database";

export interface Strategy {
  _id: ObjectId;
  type: string;
  name: string;
  title: string;
  icon: string;
  [index: string]: any;
}

export interface SamlStrategy extends Strategy {
  options: {
    sp: {
      certificate: string;
      private_key: string;
    };
    ip: {
      login_url: string;
      logout_url: string;
      certificate: string;
    };
  };
}
