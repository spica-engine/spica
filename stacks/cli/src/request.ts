import * as request from "request-promise-native";

export function getRequest(url: string): Promise<any> {
  const requestOptions = {
    method: "GET",
    uri: url,
    json: true
  };
  return request(requestOptions);
}

export async function postRequest(url: string, body?: object, header?: object): Promise<any> {
  const requestOptions = {
    method: "POST",
    uri: url,
    json: true,
    body: body,
    header: header
  };
  return request(requestOptions);
}

export async function deleteRequest(url: string, header?: object): Promise<any> {
  const requestOptions = {
    method: "DELETE",
    uri: url,
    json: true,
    header: header
  };
  return request(requestOptions);
}
