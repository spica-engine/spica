import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  CommandLineInputs,
  validators
} from "@ionic/cli-framework";
import {Command} from "../interface";
import * as authentication from "../authentication";
import * as request from "../request";
import * as utilities from "../utilities";
import * as formatter from "../formatter";
import {Function, Asset} from "../interface";
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
    let assets: Asset[] = [];
    let token;
    let server;

    try {
      const loginData = await authentication.getLoginData();
      token = loginData.token;
      server = loginData.server;
    } catch (error) {
      this.namespace.logger.error("You need to login before start this action. To login: ");
      this.namespace.logger.info("spica login <username> <password>");
      return;
    }

    try {
      let functions = (await request.getRequest(`${server}/function`, {
        Authorization: token
      })) as Array<Function>;
      if (!functions.length) return;

      await Promise.all(
        functions.map(async func => {
          const index = await request
            .getRequest(`${server}/function/${func._id}/index`, {
              Authorization: token
            })
            .catch(error => {
              return {index: ""};
            });
          func.indexPath = `${outputPath}/${func._id}/index.ts`;

          const dependencies = await request
            .getRequest(`${server}/function/${func._id}/dependencies`, {Authorization: token})
            .catch(error => []);
          func.dependencies = dependencies;

          assets.push(formatter.createFunctionAsset(func));
          await utilities
            .writeFile(func.indexPath, index.index)
            .then(result => this.namespace.logger.success(result))
            .catch(error => this.namespace.logger.info(error.message));
        })
      );

      await utilities
        .writeFile(`${outputPath}/asset.yaml`, yaml.stringify(assets))
        .then(result => this.namespace.logger.success(result))
        .catch(error => this.namespace.logger.info(error.message));
    } catch (error) {
      this.namespace.logger.error(error.message);
    }
  }
}
