import * as httpService from "./request";

import * as utilities from "./utilities";
import * as fs from "fs";

export function authenticate(username: string, password: string, serverUrl: string): Promise<any> {
  return httpService.getRequest(
    `${serverUrl}/passport/identify?password=${password}&identifier=${username}`
  );
}


export async function getLoginData(): Promise<LoginData> {
  const rcFile = JSON.parse((await fs.promises.readFile(utilities.getRcPath())).toString());
  const loginData: LoginData = {
    token: rcFile.token,
    server: rcFile.server
  };
  if (!loginData.token || !loginData.server)
    throw {message: "Token or server information is missing."};
  return loginData;
}

interface LoginData {
  token: string;
  server: string;
}
