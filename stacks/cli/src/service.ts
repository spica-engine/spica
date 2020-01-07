import * as request from "request-promise-native";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as yaml from "yaml"

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
  return await writeFile(getRcPath(), JSON.stringify(data)).then(_ => "Successfully logged in.");
}

export async function pullFunctions(folderPath: string) {
  //check login status
  const loginData: LoginData = await getLoginData();
  //send pull request
  const functions: Function[] = await getDataRequest(loginData, `${loginData.server}/function`);
  //write functions
  for (let index = 0; index < functions.length; index++) {
    const functionIndex: FunctionIndex = await getDataRequest(
      loginData,
      `${loginData.server}/function/${functions[index]._id}/index`
    );
    await writeFile(path.join(folderPath, functions[index]._id, "index.ts"), functionIndex.index);
  }
  //write yaml
  let yamlFile: YamlObject[] = [];
  for (let index = 0; index < functions.length; index++) {
    const yamlObject:YamlObject = {
      kind:"Function",
      metadata:functions[index]._id,
      spec:functions[index]
    }
    delete yamlObject.spec._id;
    delete yamlObject.spec.info;
    yamlFile.push(yamlObject)
  }
  return yamlFile;
  //return success
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

async function getDataRequest(loginData: LoginData, url: string) {
  const requestOptions = {
    headers: {
      Authorization: loginData.token
    },
    method: "GET",
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
  info?:any
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

export interface YamlObject {
  kind: string;
  metadata: string ;
  spec: Function
}

