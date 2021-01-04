import {register} from "../../scheme";
import {Function} from "./function";
import {Trigger} from "./trigger";

register({
  definition: Function,
  prepareForCreate: (obj: any) => {
    // TODO: handle this
    //obj.spec.runtime.version = process.version;
  },
  prepareForUpdate: (obj: any) => {
    // TODO: handle this
    //obj.spec.runtime.version = process.version;
  }
});

register({
  definition: Trigger
});
