import {
  Command,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  CommandLineInputs,
  CommandLineOptions,
  validators
} from "@ionic/cli-framework";

import * as authentication from "../../../authentication";
import * as request from "../../../request";
import {Function} from "../../../interface";
import {Logger} from "../../../logger";

export class InstallCommand extends Command {
  logger?: Logger = new Logger(process.stdout, process.stderr);
  authentication = authentication;
  request = request;

  token;
  server;

  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "install",
      summary: "Install npm-package to function.",
      inputs: [
        {
          name: "package-name",
          summary: "The name of npm-package that will be installed.",
          validators: [validators.required]
        }
      ],
      options: [
        {
          name: "all",
          summary: "Install specified npm-package to each function.",
          type: Boolean
        }
      ]
    };
  }

  showLoginError() {
    this.logger.error("You need to login before start this action. To login: ");
    this.logger.info("spica login <username> <password>");
  }

  async validate(argv: CommandLineInputs) {
    try {
      const loginData = await this.authentication.getLoginData();
      this.token = loginData.token;
      this.server = loginData.server;
    } catch (error) {
      this.showLoginError();
    }
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    const [packageName] = inputs;
    const {all: isAll} = options;

    if (!this.token || !this.server) return;

    if (isAll) {
      let functions = (await this.request
        .getRequest(`${this.server}/function`, {
          Authorization: this.token
        })
        .catch(error => {
          this.logger.error(error.message);
        })) as Array<Function>;

      if (!functions) return;

      if (!functions.length) {
        this.logger.error("Couldn't find any function.");
        return;
      }

      await Promise.all(
        functions.map(func => {
          this.request
            .postRequest(
              `${this.server}/function/${func._id}/dependencies`,
              {
                name: packageName
              },
              {Authorization: this.token}
            )
            .then(() =>
              this.logger.success(
                `Successfully installed dependency '${packageName}' to the function named '${func.name}'.`
              )
            )
            .catch(err => {
              this.logger.error(
                `Failed to install dependency '${packageName}' to the function named '${func.name}' cause of ${err.message}`
              );
            });
        })
      );
    } else {
      this.logger.info("Please use --all until this feature improved");
    }
  }
}
