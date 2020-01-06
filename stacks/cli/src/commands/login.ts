import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataInput,
  CommandMetadataOption,
  CommandLineInputs
} from "@ionic/cli-framework";
import {Command} from "../interface";
import * as request from "request-promise-native";
import * as fs from "fs";
import {homedir} from "os";

export class LoginCommand extends Command {
  async getMetadata(): Promise<CommandMetadata<CommandMetadataInput, CommandMetadataOption>> {
    return {
      name: "login",
      summary: "Login to spica with your credentials.",
      inputs: [
        {
          name: "username",
          summary: "Username of your account"
        },
        {
          name: "password",
          summary: "Password of your account"
        }
      ],
      options: [
        {
          name: "url",
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

    if (!(username && password)) {
      this.namespace.logger.error("Username and password are required fields");
      return;
    }
    const requestOptions = {
      method: "GET",
      uri: `${options["url"]}/passport/identify?password=${password}&identifier=${username}`,
      json: true
    };

    try {
      const token = (await request(requestOptions)).token;
      fs.writeFile(`${homedir}/.spicarc`, JSON.stringify({token: token}), error => {
        error
          ? this.namespace.logger.error(error.message)
          : this.namespace.logger.success("Successfully logged in.");
      });
    } catch (error) {
      this.namespace.logger.error(error.message);
    }
  }
}
