import {CommandMap, execute, NamespaceMetadata} from "@ionic/cli-framework";
import {ListCommand} from "./commands/list";
import {RemoveCommand} from "./commands/remove";
import {RunCommand} from "./commands/run";
import {SpicaNamespace} from "./interface";
import {Logger} from "./logger";

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
      ["run", async () => new RunCommand(this)],
      ["ls", async () => new ListCommand(this)],
      ["rm", async () => new RemoveCommand(this)]
    ]);
  }
}

execute({
  namespace: new RootNamespace(),
  argv: process.argv.slice(2),
  env: process.env
});
