import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  CommandLineInputs,
  validators
} from "@ionic/cli-framework";
import {Command, Function} from "../interface";
import * as authentication from "../authentication.service";
import * as request from "../request";
import * as utilites from "../utilities";
import {Asset} from "../interface";
import * as formatter from "../formatter";

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
    let functionAssets: Asset[];
    try {
      const assets = yaml.parse((await fs.promises.readFile(assetFilePath)).toString());
      functionAssets = formatter.filterFunctionsOnAssets(assets);
    } catch (error) {
      this.namespace.logger.error("Make sure asset file is correct.");
      return;
    }

    try {
      const loginData = await authentication.getLoginData();
      token = loginData.token;
      server = loginData.server;
    } catch (error) {
      this.namespace.logger.error("You need to login before start this action. To login: ");
      this.namespace.logger.info("spica login <username> <password>");
      return;
    }

    await Promise.all(
      ((await request
        .getRequest(`${server}/function`, {
          Authorization: token
        })
        .catch(error => [])) as Array<Function>).map(func => {
        request.deleteRequest(`${server}/function/${func._id}`, {
          Authorization: token
        });
      })
    );

    await Promise.all(
      functionAssets.map(async funcAsset => {
        const id = await request
          .postRequest(`${server}/function`, funcAsset.spec, {
            Authorization: token
          })
          .then(response => response._id)
          .catch(error => this.namespace.logger.error(error.message));
        if (!id) return;
        const index = (await fs.promises
          .readFile(funcAsset.spec.indexPath)
          .catch(error => "")).toString();
        await request
          .postRequest(
            `${server}/function/${id}/index`,
            {index: index},
            {
              Authorization: token
            }
          )
          .then(_ =>
            this.namespace.logger.success(`'${funcAsset.spec.name}' function pushed.`)
          )
          .catch(error => this.namespace.logger.error(error.message));
      })
    );
  }
}
