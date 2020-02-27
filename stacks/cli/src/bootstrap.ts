import {
  CommandMap,
  execute,
  NamespaceMetadata,
  DEFAULT_COLORS,
  NamespaceMap
} from "@ionic/cli-framework";
import {ListCommand} from "./commands/list";
import {RemoveCommand} from "./commands/remove";
import {ServeCommand} from "./commands/serve";
import {LoginCommand} from "./commands/login";
import {PullCommand} from "./commands/pull";
import {PushCommand} from "./commands/push";
import {SpicaNamespace} from "./interface";
import {Logger} from "./logger";
import chalk from "chalk";
import {FunctionNamespace} from "./commands/function/index";

class RootNamespace extends SpicaNamespace {
  logger?: Logger = new Logger(process.stdout, process.stderr);
  async getMetadata(): Promise<NamespaceMetadata> {
    return {
      name: "spica",
      summary: "CLI for fast local development.",
      description: "Spica is a development engine for building fast & efficient applications."
    };
  }

  async getCommands(): Promise<CommandMap> {
    return new CommandMap([
      ["serve", async () => new ServeCommand(this)],
      ["ls", async () => new ListCommand(this)],
      ["rm", async () => new RemoveCommand(this)],
      ["login", async () => new LoginCommand(this)],
      ["pull", async () => new PullCommand(this)],
      ["push", async () => new PushCommand(this)]
    ]);
  }

  async getNamespaces(): Promise<NamespaceMap> {
    return new NamespaceMap([["function", async () => new FunctionNamespace(this)]]);
  }
}

execute({
  namespace: new RootNamespace(),
  argv: process.argv.slice(2),
  env: process.env,
  colors: {
    ...DEFAULT_COLORS,
    input: chalk.hex("#588fd2")
  }
});
