import * as request from "request-promise-native";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

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

function getRcPath() {
  return path.join(os.homedir(), ".spicarc");
}

async function writeFile(fullPath: string, data: string): Promise<void> {
  const dirName = path.dirname(fullPath);
  await fs.promises.mkdir(dirName, {recursive: true});
  return await fs.promises.writeFile(fullPath, data);
}
