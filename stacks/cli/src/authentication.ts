import * as fs from "fs";
import {LoginData} from "./interface";
import {request} from "./request";
import * as utilities from "./utilities";

export function authenticate(username: string, password: string, serverUrl: string): Promise<any> {
  return request.get(`${serverUrl}/passport/identify?password=${password}&identifier=${username}`);
}

export namespace context {
  export async function url(path: string) {
    const {server} = await data();
    return `${server}${path}`;
  }

  export async function authorizationHeaders() {
    const {token} = await data();
    return {
      Authorization: token
    };
  }

  export async function hasAuthorization() {
    return data()
      .then(() => true)
      .catch(() => false);
  }

  async function data(): Promise<LoginData> {
    const rcContent = await fs.promises.readFile(utilities.getRcPath()).catch(e => {
      if (e.code == "ENOENT") {
        return Promise.resolve("{}");
      }
      return Promise.reject(e);
    });
    const rcFile = JSON.parse(rcContent.toString());
    const loginData: LoginData = {
      token: rcFile.token,
      server: rcFile.server
    };
    if (!loginData.token || !loginData.server)
      throw new Error("Token or server information is missing.");
    return loginData;
  }
}
