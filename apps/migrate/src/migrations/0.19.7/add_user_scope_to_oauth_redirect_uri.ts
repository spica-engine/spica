import {Context} from "../../migrate";

const previousPath = "/passport/strategy/";
const currentPath = "/passport/user/strategy/";

export default async function (ctx: Context) {
  const coll = ctx.database.collection("strategy");

  const strategies = await coll
    .find(
      {type: "oauth", "options.code.params.redirect_uri": {$regex: previousPath}},
      {session: ctx.session}
    )
    .toArray();

  for (const strategy of strategies) {
    const redirectUri = strategy.options.code.params.redirect_uri.replace(
      previousPath,
      currentPath
    );

    await coll.updateOne(
      {_id: strategy._id},
      {
        $set: {
          "options.code.params.redirect_uri": redirectUri,
          "options.access_token.params.redirect_uri": redirectUri
        }
      },
      {session: ctx.session}
    );
  }
}
