import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  CommandLineInputs,
  validators
} from "@ionic/cli-framework";
import {Command} from "../interface";
import * as loginService from "../login.service";
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

    await loginService
      .login(username, password, options["server"].toString())
      .then(response => this.namespace.logger.success(response))
      .catch(error => this.namespace.logger.error(error.message));
  }
}
