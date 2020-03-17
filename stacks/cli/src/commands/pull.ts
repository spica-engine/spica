import {
  CommandLineInputs,
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  validators
} from "@ionic/cli-framework";
import * as path from "path";
import * as yaml from "yaml";
import {context} from "../authentication";
import {noAuthorizationError} from "../errors";
import * as formatter from "../formatter";
import {Asset, Command, Function} from "../interface";
import {request} from "../request";
import * as utilities from "../utilities";

export class PullCommand extends Command {
  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "pull",
      summary: "Pull packages from a server.",
      inputs: [
        {
          name: "Output folder",
          summary: "Name of the output folder to store assets.",
          validators: [validators.required]
        }
      ],
      options: [
        {
          name: "package",
          summary: "Name of the package file to write package contents",
          aliases: ["p"],
          default: "package.yaml",
          type: String
        }
      ]
    };
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    const hasAuthorization = await context.hasAuthorization();
    if (!hasAuthorization) {
      return noAuthorizationError(this.namespace.logger);
    }
    const [outputFolder] = inputs;

    const outputPath = path.join(process.cwd(), outputFolder);

    const assets: Asset[] = [];

    const functionsUrl = await context.url("/function");
    const authorizationHeaders = await context.authorizationHeaders();

    const functions = await this.namespace.logger.spin({
      text: "Fetching functions",
      op: request.get<Array<Function>>(functionsUrl, authorizationHeaders)
    });

    const progress = this.namespace.logger.spin({
      text: `Pulling functions (0/${functions.length})`
    });

    for (const [i, func] of functions.entries()) {
      try {
        const indexUrl = await context.url(`/function/${func._id}/index`);
        const {index} = await request.get<{index: string}>(indexUrl, authorizationHeaders);
        const indexPath = path.join(outputPath, func._id, "index.ts");

        await utilities.writeFile(indexPath, index);
        func.indexPath = path.join(func._id, "index.ts");

        const dependenciesUrl = await context.url(`/function/${func._id}/dependencies`);
        const dependencies = await request.get(dependenciesUrl, authorizationHeaders);

        // @ts-ignore
        func.dependencies = dependencies;

        assets.push(formatter.createFunctionAsset(func));

        progress.text = `Pulling functions (${i + 1}/${functions.length})`;
      } catch (e) {
        progress.fail();
        this.namespace.logger.error(e);
      }
    }

    progress.succeed();

    this.namespace.logger.success(`All functions are pulled successfully.`);

    await utilities.writeFile(
      path.join(outputPath, options.package.toString()),
      yaml.stringify(assets)
    );
  }
}
