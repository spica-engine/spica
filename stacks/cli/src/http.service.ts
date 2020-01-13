import * as request from "request-promise-native";

export async function getRequest(url: string): Promise<any> {
  const requestOptions = {
    method: "GET",
    uri: url,
    json: true
  };
  const response = await request(requestOptions);
  return response;
}

export async function postRequest(url: string, body?: object, header?: object): Promise<any> {
  const requestOptions = {
    method: "POST",
    uri: url,
    json: true,
    body: body,
    header: header
  };
  const response = await request(requestOptions);
  return response;
}

export async function deleteRequest(url: string, header?: object): Promise<any> {
  const requestOptions = {
    method: "DELETE",
    uri: url,
    json: true,
    header: header
  };
  const response = await request(requestOptions);
  return response;
}


