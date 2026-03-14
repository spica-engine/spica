import {Context} from "../../migrate";

export default async function (ctx: Context) {
  const admin = ctx.database.admin();
  await admin.command({
    setFeatureCompatibilityVersion: "5.0"
  });
}
