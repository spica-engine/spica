import * as httpService from "./request";
import * as utilities from "./utilities";
import * as fs from "fs";

export function authenticate(username: string, password: string, serverUrl: string): Promise<any> {
  return httpService.getRequest(
    `${serverUrl}/passport/identify?password=${password}&identifier=${username}`
  );
}

export function getLoginStatus(): Promise<Buffer> {
  return fs.promises.readFile(utilities.getRcPath());
}
