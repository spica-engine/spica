import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  CommandLineInputs,
  validators
} from "@ionic/cli-framework";
import {Command} from "../interface";
import * as service from "../service";

export class PullCommand extends Command {
  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "pull",
      summary: "Pull assets from the server.",
      inputs: [
        {
          name: "Output folder",
          summary: "Name of output folder to store assets.",
          validators: [validators.required]
        }
      ]
    };
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    await service
      .pullFunctions(inputs[0].toString())
      .then(result => this.namespace.logger.success(result))
      .catch(error => this.namespace.logger.error(error.message));
  }
}
