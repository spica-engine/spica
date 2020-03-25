import {
  Command,
  CommandLineInputs,
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  validators
} from "@ionic/cli-framework";
import {context} from "@spica/cli/src/authentication";
import {noAuthorizationError} from "@spica/cli/src/errors";
import {Function} from "@spica/cli/src/interface";
import {getLogger, Logger} from "@spica/cli/src/logger";
import {request} from "@spica/cli/src/request";

export class InstallCommand extends Command {
  logger: Logger = getLogger();

  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "install",
      summary: "Install a package to function.",
      inputs: [
        {
          name: "name",
          summary: "The name of package that will be installed.",
          validators: [validators.required]
        }
      ],
      options: [
        {
          name: "all",
          summary: "Install the package to all functions.",
          type: Boolean
        }
      ]
    };
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    const hasAuthorization = await context.hasAuthorization();
    if (!hasAuthorization) {
      return noAuthorizationError(this.logger);
    }

    const [packageName] = inputs;

    if (options.all) {
      const functionUrl = await context.url("/function");
      const authorizationHeaders = await context.authorizationHeaders();
      let functions = await this.logger.spin({
        text: "Indexing functions",
        op: request.get<Function[]>(functionUrl, authorizationHeaders)
      });

      if (!functions.length) {
        return this.logger.info("There are no functions to install the package.");
      }

      await this.logger.spin({
        text: `Installing the package '${packageName}' to functions (0/${functions.length})`,
        op: async spinner => {
          for (const [i, func] of functions.entries()) {
            const functionDependencyUrl = await context.url(
              `/function/${func._id}/dependencies?progress=true`
            );
            const installProgress = await request.stream.post({
              url: functionDependencyUrl,
              body: {
                name: packageName
              },
              headers: authorizationHeaders
            });

            await new Promise((resolve, reject) => {
              installProgress.on("data", chunk => {
                try {
                  // TODO: Investigate why we receive undefined:2 sometimes
                  // I guess it has something to do with the NGINX on the production server
                  chunk = JSON.parse(chunk.toString());
                } catch (e) {
                  if (e instanceof SyntaxError) {
                    return;
                  }
                  throw e;
                }

                if (chunk.state == "installing") {
                  spinner.text = `Installing the package '${packageName}' to functions (${i}/${functions.length}) (${chunk.progress}%)`;
                } else {
                  reject(new Error(chunk.message));
                }
              });
              installProgress.on("end", resolve);
              installProgress.on("error", reject);
            });
            spinner.text = `Installing the package '${packageName}' to functions (${i + 1}/${
              functions.length
            })`;
          }
        }
      });
    } else {
      this.logger.warn("Option --all should be present as true otherwise it won't work.");
    }
  }
}
