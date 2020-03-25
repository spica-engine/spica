import {
  CommandLineInputs,
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  validators
} from "@ionic/cli-framework";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import {context} from "../authentication";
import {noAuthorizationError} from "../errors";
import * as formatter from "../formatter";
import {Asset, Command, Function} from "../interface";
import {request} from "../request";

export class PushCommand extends Command {
  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "push",
      summary: "Push your package to a server.",
      inputs: [
        {
          name: "path",
          summary: "Root directory of the package to push",
          validators: [validators.required]
        }
      ],
      options: [
        {
          name: "package",
          summary: "Name of the package file to read package contents",
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

    const [inputFolder] = inputs;

    process.chdir(path.join(process.cwd(), inputFolder));

    let assets: Asset[];

    const packageContent = yaml.parse(
      (await fs.promises.readFile(options.package.toString())).toString()
    );
    assets = formatter.filterFunctionsOnAssets(packageContent);

    const authorizationHeaders = await context.authorizationHeaders();

    const functionsUrl = await context.url("/function");

    const upstreamFunctions = await this.namespace.logger.spin({
      text: "Fetching remote functions",
      op: request.get<Function[]>(functionsUrl, authorizationHeaders)
    });

    await this.namespace.logger.spin({
      text: `Removing functions from upstream. (0/${upstreamFunctions.length})`,
      op: async spinner => {
        let deleted = 1;
        for (const upstreamFunc of upstreamFunctions) {
          const functionUrl = await context.url(`/function/${upstreamFunc._id}`);
          await request.del(functionUrl, authorizationHeaders);
          spinner.text = `Removing functions from upstream. (${deleted++}/${
            upstreamFunctions.length
          })`;
        }
      }
    });

    await this.namespace.logger.spin({
      text: `Pushing functions to upstream. (0/${assets.length})`,
      op: async spinner => {
        let pushed = 1;
        for (const asset of assets) {
          const func = {...asset.spec};
          delete func.indexPath;
          delete func.dependencies;
          const {_id} = await request.post(functionsUrl, func, authorizationHeaders);

          const index = await fs.promises.readFile(asset.spec.indexPath);
          const functionUrl = await context.url(`/function/${_id}/index`);
          await request.post(functionUrl, {index: index.toString()}, authorizationHeaders);

          if (Array.isArray(asset.spec.dependencies)) {
            for (const dependency of asset.spec.dependencies) {
              const functionDependencyUrl = await context.url(`/function/${_id}/dependencies`);
              await request.post(
                functionDependencyUrl,
                {
                  name: `${dependency.name}@${dependency.version}`
                },
                authorizationHeaders
              );
            }
          }

          spinner.text = `Pushing functions to upstream. (${pushed++}/${assets.length})`;
        }
      }
    });
  }
}
