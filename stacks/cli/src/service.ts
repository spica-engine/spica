import * as request from "request-promise-native";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as yaml from "yaml";

export async function login(username: string, password: string, url: string): Promise<string> {
  const requestOptions = {
    method: "GET",
    uri: `${url}/passport/identify?password=${password}&identifier=${username}`,
    json: true
  };

  const response = await request(requestOptions);
  const data = {
    token: response.token,
    server: url
  };
  return await writeFile(getRcPath(), JSON.stringify(data)).then(
    result => "Successfully logged in."
  );
}

export async function pullFunctions(folderName: string) {
  const folderPath = path.join(process.cwd(), folderName);
  const loginData: LoginData = await getLoginData();
  const functions: Function[] = await sendGetRequest(
    loginData.token,
    `${loginData.server}/function`
  );
  let assets: Asset[] = [];
  for (let index = 0; index < functions.length; index++) {
    const functionIndex: FunctionIndex = await sendGetRequest(
      loginData.token,
      `${loginData.server}/function/${functions[index]._id}/index`
    ).catch(error => {
      //we need to keep writing functions even some of them hasn't any index.
      if (error.statusCode == 500)
        return {
          index: ""
        };
    });
    await writeFile(
      `${folderPath}/functions/${functions[index]._id}/index.ts`,
      functionIndex.index
    );

    const functionDependencies: Dependency[] = await sendGetRequest(
      loginData.token,
      `${loginData.server}/function/${functions[index]._id}/dependencies`
    ).catch(error => {
      //we need to keep writing functions even some of them hasn't any dependency.
      if (error.statusCode == 500) return {};
    });

    const asset = createFunctionAsset(
      functions[index],
      `${folderPath}/functions/${functions[index]._id}/index.ts`,
      functionDependencies
    );
    assets.push(asset);
  }

  return await writeFile(`${folderPath}/asset.yaml`, yaml.stringify(assets)).then(
    result => `Successfully pulled assets to: ${folderPath}`
  );
}

export async function pushFunctions(filePath: string) {
  //check login status
  const loginData: LoginData = await getLoginData();

  //prepare your request
  //read file
  let assets: Asset[] = [];
  const data = await fs.promises.readFile(filePath);
  try {
    assets = yaml.parse(data.toString());
    if (!assets.length) throw {message: "Make sure this file has correct syntax."};
  } catch (error) {
    throw {message: "Make sure this file has correct syntax."};
  }
  //delete functions

  const functionIds: string[] = ((await sendGetRequest(
    loginData.token,
    `${loginData.server}/function`
  )) as Array<Function>).map(func => func._id);
  for (let index = 0; index < functionIds.length; index++) {
    await sendDeleteRequest(loginData.token, `${loginData.server}/function/${functionIds[index]}`);
    await sendDeleteRequest(loginData.token, `${loginData.server}/function/${functionIds[index]}/logs`)
    //also we will need to delete rest of function files which isn't accessible from rest api
  }
  //create json post data
  for (let index = 0; index < assets.length; index++) {
    const func: Function = assets[index].spec;
    //add requets
    const addBody = filterFunctionFields(func);
    //await sendPostRequest(loginData.token, `${loginData.server}/function/add`, addBody);
    //dependency request
    const dependencyBody = func.dependencies ? Object.keys(func.dependencies) : {};
    //last

    //index requets
    //const indexBody = (await fs.promises.readFile(func.indexPath)) || {index: ""};
  }

  //send request

  //return response
}

function filterFunctionFields(func: Function) {
  delete func._id;
  delete func.dependencies;
  delete func.indexPath;
  delete func.info;
  return func;
}

function createFunctionAsset(func: Function, path: string, dependencies: Dependency[]): Asset {
  const asset: Asset = {
    kind: "Function",
    metadata: func._id,
    spec: func
  };
  asset.spec.indexPath = path;
  asset.spec.dependencies = dependencies;
  delete asset.spec._id;
  delete asset.spec.info;
  return asset;
}

async function getLoginData() {
  try {
    const data = await fs.promises.readFile(getRcPath());
    const token = JSON.parse(data.toString()).token;
    const server = JSON.parse(data.toString()).server;
    if (!token || !server) {
      throw {message: "You need to login before this action."};
    }
    const loginData: LoginData = {
      token: token,
      server: server
    };
    return loginData;
  } catch (error) {
    throw {message: "You need to login before this action."};
  }
}

async function sendGetRequest(token: string, url: string) {
  const requestOptions = {
    headers: {
      Authorization: token
    },
    method: "GET",
    uri: url,
    json: true
  };
  const response = await request(requestOptions);
  return response;
}

async function sendDeleteRequest(token: string, url: string) {
  const requestOptions = {
    headers: {
      Authorization: token
    },
    method: "DELETE",
    uri: url,
    json: true
  };
  const response = await request(requestOptions);
  return response;
}

async function sendPostRequest(token: string, url: string, body: Object) {
  const requestOptions = {
    headers: {
      Authorization: token
    },
    method: "POST",
    body: body,
    uri: url,
    json: true
  };
  const response = await request(requestOptions);
  return response;
}

function getRcPath() {
  return path.join(os.homedir(), ".spicarc");
}

async function writeFile(fullPath: string, data: string): Promise<void> {
  const dirName = path.dirname(fullPath);
  await fs.promises.mkdir(dirName, {recursive: true});
  return await fs.promises.writeFile(fullPath, data);
}

export interface LoginData {
  token: string;
  server: string;
}

export interface Function {
  _id?: string;
  env?: Environment;
  triggers: Triggers;
  memoryLimit?: number;
  timeout?: number;
  info?: any;
  indexPath?: string;
  dependencies?: string[];
}

export interface Environment {
  [key: string]: string;
}

export interface Triggers {
  default: Trigger;
  [key: string]: Trigger;
}

export interface Trigger {
  type: string;
  active?: boolean;
  options: any;
}

export interface FunctionIndex {
  index: string;
}

export interface Asset {
  kind: string;
  metadata: string;
  spec: any;
}

export interface Dependency {
  [key: string]: string;
}
