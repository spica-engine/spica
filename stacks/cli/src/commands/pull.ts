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
import * as yaml from "yaml";

export class PullCommand extends Command {
  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "pull",
      summary: "Pull your data from server.",
      inputs: [{name: "folder name", summary: "Folder name of your data that will store."}],
      options: [
        {
          name: "url",
          type: String,
          summary: "URL of the spica server that you will pull your data.",
          default: "http://localhost:4300"
        }
      ]
    };
  }

  async getData<T = any>(token: string, uri: string): Promise<T> {
    const requestOptions = {
      method: "GET",
      headers: {
        Authorization: token
      },
      uri: uri,
      json: true
    };

    let data = await request(requestOptions);
    return data;
  }

  writeFiletoPath(path: string, fileName: string, data: any) {
    try {
      fs.mkdirSync(path, {recursive: true});
      fs.writeFileSync(`${path}/${fileName}`, data);
      this.namespace.logger.success(
        `Writing file is successfull. Check this path: ${path}/${fileName}`
      );
    } catch (error) {
      this.namespace.logger.error(error.message);
    }
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    try {
      const folder = inputs[0];
      if (!folder) {
        this.namespace.logger.error(
          "You need to specify folder name of data that will store. For help:"
        );
        this.namespace.logger.info("spica pull --help");
        return;
      }
      if (!fs.existsSync(`${homedir}/.spicarc`)) {
        this.namespace.logger.error(
          "You need to login before this action. To login, use this command:"
        );
        this.namespace.logger.info("spica login <username> <password>");
        return;
      }
      const token = JSON.parse(fs.readFileSync(`${homedir}/.spicarc`).toString()).token;

      let functions = await this.getData(token, `${options["url"]}/function`);
      if (!functions) {
        this.namespace.logger.error("There is no function to pull.");
        return;
      }

      for (let index = 0; index < functions.length; index++) {
        const code = await this.getData(
          token,
          `${options["url"]}/function/${functions[index]._id}/index`
        );
        this.writeFiletoPath(
          `${process.cwd()}/${folder}/${functions[index]._id}`,
          "index.ts",
          code.index
        );
      }

      for (let index = 0; index < functions.length; index++) {
        delete functions[index].info;
        functions[index] = {
          kind: "Function",
          metadata: {
            name: functions[index]._id
          },
          spec: {
            ...functions[index],
            index: `${process.cwd()}/${folder}/${functions[index]._id}/index.ts`
          }
        };
        delete functions[index].spec._id;
      }
      this.writeFiletoPath(`${process.cwd()}/${folder}`, "asset.yaml", yaml.stringify(functions));
    } catch (error) {
      this.namespace.logger.error(error.message);
    }
  }
}
