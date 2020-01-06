import * as request from "request-promise-native";
import * as fs from "fs";
import {homedir} from "os";

export class Service {
  async login(username: string, password: string, url: string): Promise<string> {
    const requestOptions = {
      method: "GET",
      uri: `${url}/passport/identify?password=${password}&identifier=${username}`,
      json: true
    };

    try {
      const response = await request(requestOptions);
      const data = {
        token: response.token,
        server: url
      };
      this.writeFiletoPath(`${homedir}`, ".spicarc", data);
      return "Successfully logged in.";
    } catch (error) {
      throw error;
    }
  }

  writeFiletoPath(path: string, fileName: string, data: any): string {
    try {
      fs.mkdirSync(path, {recursive: true});
      fs.writeFileSync(`${path}/${fileName}`, JSON.stringify(data));
      return `Writing file is successfull. Check: ${path}/${fileName}`;
    } catch (error) {
      throw error;
    }
  }
}
