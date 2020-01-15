import * as request from "request-promise-native";

export function getRequest(url: string, headers?: object): Promise<any> {
  const requestOptions = {
    method: "GET",
    uri: url,
    json: true,
    headers: headers
  };
  return request(requestOptions);
}

export async function postRequest(url: string, body?: object, headers?: object): Promise<any> {
  const requestOptions = {
    method: "POST",
    uri: url,
    json: true,
    body: body,
    headers: headers
  };
  return request(requestOptions);
}

export async function deleteRequest(url: string, headers?: object): Promise<any> {
  const requestOptions = {
    method: "DELETE",
    uri: url,
    json: true,
    headers: headers
  };
  return request(requestOptions);
}
