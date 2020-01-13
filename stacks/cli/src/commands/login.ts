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
import * as fileService from "../file.service";

export class LoginCommand extends Command {
  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "login",
      summary: "Login to spica with your credentials.",
      inputs: [
        {
          name: "username",
          summary: "Username of your account",
          validators: [validators.required]
        },
        {
          name: "password",
          summary: "Password of your account",
          validators: [validators.required]
        }
      ],
      options: [
        {
          name: "server",
          summary: "URL of the spica server that will identify your credentials.",
          type: String,
          default: "http://localhost:4300"
        }
      ]
    };
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    const username = inputs[0];
    const password = inputs[1];
    const server = options["server"].toString();

    try {
      const response = await authenticationService.identify(username, password, server);
      await fileService.writeFile(`${fileService.getRcPath()}`, {
        token: response.token,
        server: server
      })
      this.namespace.logger.success("Successfully logged in.");
    } catch (error) {
      this.namespace.logger.error(error.message);
    }
  }
}
