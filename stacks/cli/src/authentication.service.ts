import * as httpService from "./http.service";

export function identify(username: string, password: string, serverUrl: string): Promise<any> {
    return httpService.getRequest(
      `${serverUrl}/passport/identify?password=${password}&identifier=${username}`
    );
}
