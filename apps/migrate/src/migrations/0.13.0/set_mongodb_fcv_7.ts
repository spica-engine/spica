import {Context} from "../../migrate";

export default async function (ctx: Context) {
  const admin = ctx.database.admin();
  await admin.command({
    setFeatureCompatibilityVersion: "7.0",
    confirm: true
  });
}
