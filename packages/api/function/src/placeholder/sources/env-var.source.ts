import {Injectable} from "@nestjs/common";
import {PlaceholderSource, RuntimeFunction} from "../placeholder-source.js";

@Injectable()
export class EnvVarSource implements PlaceholderSource {
  readonly prefix = "ENV";

  load(fn: RuntimeFunction): Map<string, string> {
    return new Map((fn.env_vars ?? []).map(envVar => [envVar.key, envVar.value]));
  }
}
