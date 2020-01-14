import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  CommandLineInputs,
  validators
} from "@ionic/cli-framework";
import {Command} from "../interface";
import * as authenticationService from "../authentication.service";
import * as httpService from "../request";
import * as utilities from "../utilities";
import * as path from "path";
import * as yaml from "yaml";

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
    const outputPath = path.join(process.cwd(), inputs[0]);
    let assets = [];
    let token;
    let server;

    try {
      const loginData = JSON.parse((await authenticationService.getLoginData()).toString());
      token = loginData.token;
      server = loginData.server;
      if (!token || !server) throw {};
    } catch (error) {
      this.namespace.logger.error("You need to login before start this action. To login: ");
      this.namespace.logger.info("spica login <username> <password>");
      return;
    }

    try {
      let functions = (await httpService.getRequest(`${server}/function`, {
        Authorization: token
      })) as Array<any>;
      if (!functions.length) return;

      await Promise.all(
        functions.map(async func => {
          const index = await httpService
            .getRequest(`${server}/function/${func._id}/index`, {
              Authorization: token
            })
            .catch(error => {
              return {index: null};
            });
          const dependencies = await httpService
            .getRequest(`${server}/function/${func._id}/dependencies`, {Authorization: token})
            .catch(error => []);
          func = {
            ...func,
            indexPath: `${outputPath}/${func._id}/index.ts`,
            dependencies: dependencies
          };
          assets.push(utilities.createAsset("Function", func));
          const result = utilities
            .writeFile(func.indexPath, index.index)
            .then(result => this.namespace.logger.info(result))
            .catch(error => this.namespace.logger.info(error.message));
        })
      );

      const result = utilities
        .writeFile(`${outputPath}/asset.yaml`, yaml.stringify(assets))
        .then(result => this.namespace.logger.info(result))
        .catch(error => this.namespace.logger.info(error.message));
    } catch (error) {
      this.namespace.logger.error(error.message);
    }
  }
}
