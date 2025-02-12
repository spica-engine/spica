import ts from "typescript";
import {TriggerTransformers} from "../interface";
import {http} from "./http";
export {HttpTransformer} from "./http";

export const triggerTransformers: TriggerTransformers<ts.Node> = new Map([
  [http.name, http.factory]
]);
// add new TriggerTransformers here like firehose, database etc.
