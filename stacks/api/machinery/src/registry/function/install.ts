import {register} from "../../scheme";
import {Function} from "./function";
import {Trigger} from "./trigger";

register({
  definition: Function,
  prepareForCreate: (obj: any) => {
    obj.spec.runtime.version = process.version;
  },
  prepareForUpdate: (obj: any) => {
    obj.spec.runtime.version = process.version;
  }
});

register({
  definition: Trigger
});
