import * as utilities from "./utilities";
import * as fs from "fs";
import * as request from "./request";

export function authenticate(username: string, password: string, serverUrl: string): Promise<any> {
  return request.getRequest(
    `${serverUrl}/passport/identify?password=${password}&identifier=${username}`
  );
}

export function getLoginData(): Promise<Buffer> {
  return fs.promises.readFile(utilities.getRcPath());
}
