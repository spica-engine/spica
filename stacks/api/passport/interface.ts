import {ObjectId} from "@spica-server/database";

export const PASSPORT_OPTIONS = "PASSPORT_OPTIONS";

export interface PassportOptions {
  issuer: string;
  audience?: string;
  secretOrKey: string;
  defaultPassword?: string;
}

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
