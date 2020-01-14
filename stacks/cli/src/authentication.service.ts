import * as request from "./request";

export function authenticate(username: string, password: string, serverUrl: string): Promise<any> {
  return request.getRequest(
    `${serverUrl}/passport/identify?password=${password}&identifier=${username}`
  );
}
