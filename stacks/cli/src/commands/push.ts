import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  CommandLineInputs
} from "@ionic/cli-framework";
import {Command} from "../interface";
import * as fs from "fs";
import {homedir} from "os";

export class PushCommand extends Command {
  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "push",
      summary: "Push your changes.",
      options: [{name: "path", type: String, summary: "Path of file to push."}]
    };
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    try {
      const token = JSON.parse(fs.readFileSync(`${homedir}/.spicarc`).toString()).token;
      console.log(token);
      //validate token from server
    } catch (error) {
      this.namespace.logger.error(error.message);
    }
  }
}
