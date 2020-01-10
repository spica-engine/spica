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

export class PushCommand extends Command {
  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "push",
      summary: "Push your assets to server.",
      inputs: [
        {name: "path", summary: "Path of asset file to push.", validators: [validators.required]}
      ]
    };
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    await service
      .pushFunctions(inputs[0])
      .then(result => this.namespace.logger.success(result))
      .catch(error => this.namespace.logger.error(error));
  }
}
