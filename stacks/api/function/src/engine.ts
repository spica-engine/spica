import {Injectable} from "@nestjs/common";
import {JSONSchema7} from "json-schema";
import {FunctionService} from "./function.service";
import {Function} from "./interface";

@Injectable()
export class FunctionEngine {
  readonly schemas = new Map<string, JSONSchema7>();
  readonly runSchemas = new Map<string, JSONSchema7>();
  constructor(fs: FunctionService) {
    this.schemas.set("http", require("./http.json"));
    fs.find().then(fns => fns.forEach(fn => this.subscribe(fn)));
  }

  update(fn: Function, index: string) {}

  read(fn: Function) {}

  subscribe(fn: Function) {}

  unsubscribe(fn: Function) {}
}
