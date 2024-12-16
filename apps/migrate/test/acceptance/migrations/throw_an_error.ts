import {Context} from "@spica/migrate/src/migrate";

export default function(ctx: Context) {
  return Promise.reject("A filthy error has occurred");
}
