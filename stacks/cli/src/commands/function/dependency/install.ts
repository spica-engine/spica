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

  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "install",
      summary: "Install summary.",
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
          summary: "Install specified npm-package to each functions.",
          type: Boolean
        }
      ]
    };
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    const [packageName] = inputs;
    const {all: isAll} = options;

    let token;
    let server;

    try {
      const loginData = await authentication.getLoginData();
      token = loginData.token;
      server = loginData.server;
    } catch (error) {
      this.logger.error("You need to login before start this action. To login: ");
      this.logger.info("spica login <username> <password>");
      return;
    }

    if (isAll) {
      let functions = (await request
        .getRequest(`${server}/function`, {
          Authorization: token
        })
        .catch(error => {
          this.logger.error(error.message);
          return [];
        })) as Array<Function>;

      if (!functions.length) {
        this.logger.error("Couldn't find any function.");
        return;
      }

      functions.forEach(func => {
        request
          .postRequest(
            `${server}/function/${func._id}/dependencies`,
            {
              name: packageName
            },
            {Authorization: token}
          )
          .then(() =>
            this.logger.success(
              `Successfully installed dependency '${packageName}' to the function named '${func.name}'.`
            )
          )
          .catch(err =>
            this.logger.error(
              `Failed to install dependency '${packageName}' to the function named '${func.name}' cause of ${err.message}`
            )
          );
      });
    } else {
      this.logger.info("Please use --all.");
    }
  }
}
