import {Function as EngineFunction} from "./engine";

export interface Function extends EngineFunction {
  _id?: string;
  name: string;
  description: string;
}
