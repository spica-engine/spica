import {Command, CreateCommandParameters} from "@caporal/core";

import {context} from "../../context";

async function listContexts() {
  const contexts = context.list().map(ctx => ({
    ...ctx,
    authorization: new Array(ctx.authorization.length)
      .fill("*")
      .slice(0, 10)
      .join(" ")
  }));

  console.table(contexts, ["name", "url", "authorization"]);
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("List contexts").action(listContexts);
}
