import {HttpTriggerTransformerOptions} from "../../interface";
import {httpServiceModifiers} from "./services";
import {HttpTransformer} from "./transformer";
export {HttpTransformer} from "./transformer";

export const http = {
  name: HttpTransformer._name,
  factory: (triggers, baseUrl, options: HttpTriggerTransformerOptions) =>
    new HttpTransformer(triggers, baseUrl, options, httpServiceModifiers)
};
