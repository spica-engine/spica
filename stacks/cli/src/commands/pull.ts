import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  CommandLineInputs,
  validators
} from "@ionic/cli-framework";
import {Command} from "../interface";
import * as fs from "fs";
import * as request from "request-promise-native";
import {homedir} from "os";
import * as yaml from "yaml";
import {Service} from "../service";

export class PullCommand extends Command {
  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "pull",
      summary: "Pull your data from server.",
      inputs: [
        {
          name: "folder name",
          summary: "Folder name to store your data.",
          validators: [validators.required]
        }
      ]
    };
  }

  async getData(token: string, uri: string): Promise<Object> {
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
    const service = new Service();
    const loginData = await service.getLoginData().catch(error => {
      this.namespace.logger.error(
        "You need to login before this action. To login, use this command:"
      );
      this.namespace.logger.info("spica login <username> <password>");
    });
    if (!loginData) return;

    const functions = await service
      .getData(loginData.token, `${loginData.server}/function`)
      .catch(error => this.namespace.logger.error(error.message));
    if (!functions) return;
    


  }
}
