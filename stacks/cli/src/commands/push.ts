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
import * as utilites from "../utilities";
import {Asset} from "../utilities";

import * as fs from "fs";
import * as yaml from "yaml";

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
    const assetFilePath = inputs[0];
    let token;
    let server;
    let functions: Asset[];
    try {
      const assets = yaml.parse((await fs.promises.readFile(assetFilePath)).toString());
      functions = utilites.filterFunctionsOnAssets(assets);
    } catch (error) {
      this.namespace.logger.error("Make sure asset file is correct.");
      return;
    }

    try {
      const loginData = await authenticationService.getLoginData();
      token = loginData.token;
      server = loginData.server;
    } catch (error) {
      this.namespace.logger.error("You need to login before start this action. To login: ");
      this.namespace.logger.info("spica login <username> <password>");
      return;
    }

    await Promise.all(
      ((await httpService.getRequest(`${server}/function`, {
        Authorization: token
      })) as Array<any>).map(func => {
        httpService.deleteRequest(`${server}/function/${func._id}`, {
          Authorization: token
        });
      })
    );

    await Promise.all(
      functions.map(async func => {
        const id = await httpService
          .postRequest(`${server}/function`, func.spec, {
            Authorization: token
          })
          .then(response => response._id)
          .catch(error => this.namespace.logger.error(error.message));
        const index = (await fs.promises
          .readFile(func.spec.indexPath)
          .catch(error => "")).toString();
        await httpService
          .postRequest(
            `${server}/function/${id}/index`,
            {index: index},
            {
              Authorization: token
            }
          )
          .then(_ => this.namespace.logger.info(`Pushing '${func.spec.name}' completed.`))
          .catch(error => this.namespace.logger.error(error.message));
      })
    );
    this.namespace.logger.success("Push action completed.");
  }
}
