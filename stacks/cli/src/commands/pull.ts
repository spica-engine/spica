import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  CommandLineInputs
} from "@ionic/cli-framework";
import {Command} from "../interface";
import * as fs from "fs";
import * as request from "request-promise-native";
import {homedir} from "os";
import * as yaml from "js-yaml";

export class PullCommand extends Command {
  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "pull",
      summary: "Pull your functions.",
      options: [
        {
          name: "url",
          type: String,
          summary: "URL of the spica server that you will pull your functions.",
          default: "http://localhost:4300"
        }
      ]
    };
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    try {
      if (!fs.existsSync(`${homedir}/.spicarc`)) {
        this.namespace.logger.error("You need to login before this action.");
        return;
      }
      const token = JSON.parse(fs.readFileSync(`${homedir}/.spicarc`).toString()).token;
      const requestOptions = {
        method: "GET",
        headers: {
          Authorization: token
        },
        uri: `${options["url"]}/function`,
        json: true
      };
      let functions = await request(requestOptions);
      for (let index = 0; index < functions.length; index++) {
        let functionIndex = await request({
          ...requestOptions,
          uri: `${options["url"]}/function/${functions[index]._id}/index`
        });
        functions[index] = {...functions[index], index: functionIndex.index};
      }
      const yamlFile = yaml.safeLoad(JSON.stringify(functions));
      console.log(yamlFile)
      
    } catch (error) {
      this.namespace.logger.error(error.message);
    }
  }
}
