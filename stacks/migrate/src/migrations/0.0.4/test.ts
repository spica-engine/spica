import {Context} from "../../migrate";

export default async function (ctx: Context) {
  return Promise.resolve(new Error("something went terribly wrong"));
}
