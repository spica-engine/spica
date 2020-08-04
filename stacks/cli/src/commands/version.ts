import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption
} from "@ionic/cli-framework";
import {Command} from "../interface";

export class VersionCommand extends Command {
  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "version",
      summary: "Show version of the CLI"
    };
  }

  async run(_, options: CommandLineOptions): Promise<void> {
    this.namespace.logger.info("Node: " + process.version);
    this.namespace.logger.info("CLI: 0.0.0-PLACEHOLDER");
  }
}
