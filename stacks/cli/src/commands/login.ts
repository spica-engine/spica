import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  CommandLineInputs,
  validators
} from "@ionic/cli-framework";
import {Command} from "../interface";
import * as authentication from "../authentication";
import * as utilities from "../utilities";

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
      const response = await authentication.authenticate(username, password, server);
      await utilities.writeFile(
        `${utilities.getRcPath()}`,
        JSON.stringify({
          token: response.token,
          server: server
        })
      );
      this.namespace.logger.success("Successfully logged in.");
    } catch (error) {
      this.namespace.logger.error(error.message);
    }
  }
}
