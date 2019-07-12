import {ObjectId} from "@spica-server/database";
import {Function as EngineFunction} from "./engine";

export interface Function extends EngineFunction {
  _id?: ObjectId | string | any;
  name: string;
  description: string;
}

export interface ImportFile {
  content: {
    data: Buffer;
    type: string;
    size?: number;
  };
}
