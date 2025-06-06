import {Command, CreateCommandParameters, Program} from "@caporal/core";

import {context} from "../../context";
import {config} from "../../config";

async function listContexts() {
  const currentContext = await config.get().catch(e => {
    console.warn(e.message);
    return {context: undefined};
  });
  const contexts = context.list().map(ctx => {
    let authorization = new Array(ctx.authorization.length).fill("*").slice(0, 10).join(" ");
    if (ctx.name == currentContext.context) {
      authorization = authorization + "   (selected)";
    }

    return {
      ...ctx,
      authorization
    };
  });

  console.table(contexts, ["name", "url", "authorization"]);
}

export default function (program: Program): Command {
  return program.command("context ls", "List contexts").action(listContexts);
}
