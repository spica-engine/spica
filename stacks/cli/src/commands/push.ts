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
        },
        {
          name: "push_strategy",
          summary:
            "Function pushing strategy. Available strategies are: exclusive, concurrent or specified number that will be push concurrently",
          default: "exclusive",
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
    const strategy = options.push_strategy.toString();

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
      text: "",
      op: async spinner => {
        switch (strategy) {
          case "exclusive":
            await this.exclusive(assets, functionsUrl, authorizationHeaders, spinner);
            break;
          case "concurrent":
            await this.concurrent(assets, functionsUrl, authorizationHeaders, spinner);
            break;
          default:
            if (Number(strategy) > 1) {
              let pushed = 0;
              const chunkedAssets = chunk(assets, Number(strategy));
              spinner.text = `Pushing functions to upstream. (0/${assets.length})`;
              for (const asset of chunkedAssets) {
                pushed = pushed + asset.length;
                await this.concurrent(asset, functionsUrl, authorizationHeaders, spinner)
                  .then(() => {
                    {
                      this.namespace.logger.success(
                        `\nPushed functions to upstream.(${pushed}/${assets.length})`
                      );
                    }
                  })
                  .catch(() =>
                    this.namespace.logger.warn(
                      `\nPushed functions to upstream with fail.(${pushed}/${assets.length})`
                    )
                  );
              }
            } else {
              await this.exclusive(assets, functionsUrl, authorizationHeaders, spinner);
            }
            break;
        }
      }
    });
  }

  async exclusive(assets: any, functionsUrl: string, authorizationHeaders: any, spinner: any) {
    spinner.text = `Pushing functions to upstream. (0/${assets.length})`;
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

  async concurrent(assets: any, functionsUrl: string, authorizationHeaders: any, spinner: any) {
    spinner.text = "Pushing functions to upstream.";
    const functionIds = await Promise.all(
      assets.map(asset => {
        const func = {...asset.spec};
        delete func.indexPath;
        delete func.dependencies;
        return request
          .post<Function[]>(functionsUrl, func, authorizationHeaders)
          .then(res => {
            spinner.text = `Created function ${res["_id"]}.`;
            return res["_id"];
          })
          .catch(err => (spinner.text = err));
      })
    )
      .then(ids => {
        spinner.text = `Creating function completed.`;
        return ids;
      })
      .catch(err => (spinner.text = err));

    let indexes = [];
    let indexUrls = [];
    let dependencyUrls = [];

    for (let i = 0; i < assets.length; i++) {
      let index = await fs.promises.readFile(assets[i].spec.indexPath);
      indexes.push(index);

      let indexUrl = await context.url(`/function/${functionIds[i]}/index`);
      indexUrls.push(indexUrl);

      let dependencyUrl = await context.url(`/function/${functionIds[i]}/dependencies`);
      dependencyUrls.push(dependencyUrl);
    }

    await Promise.all(
      indexUrls
        .map((url, i) =>
          request
            .post(url, {index: indexes[i].toString()}, authorizationHeaders)
            .then(() => (spinner.text = `Pushed index of function ${functionIds[i]}`))
            .catch(err => (spinner.text = err))
        )
        .concat(
          dependencyUrls.map((url, i) => {
            if (
              Array.isArray(assets[i].spec.dependencies) &&
              assets[i].spec.dependencies.length > 0
            ) {
              const dependencyBody = {
                name: assets[i].spec.dependencies.map(
                  dependency => `${dependency.name}@${dependency.version}`
                )
              };
              return request
                .post(url, dependencyBody, authorizationHeaders)
                .then(() => (spinner.text = `Pushed dependencies of function ${functionIds[i]}`))
                .catch(err => (spinner.text = err));
            }
          })
        )
    )
      .then(() => (spinner.text = `Pushing function completed.`))
      .catch(err => (spinner.text = err));
  }
}

export function chunk(array: Asset[], size: number) {
  const chunked_arr: Asset[][] = [];
  let index = 0;
  while (index < array.length) {
    chunked_arr.push(array.slice(index, size + index));
    index += size;
  }
  return chunked_arr;
}
