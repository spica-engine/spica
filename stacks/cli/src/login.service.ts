import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as httpService from "./http.service";

export async function login(
  username: string,
  password: string,
  serverUrl: string
): Promise<string> {
  const response = await httpService.getRequest(
    `${serverUrl}/passport/identify?password=${password}&identifier=${username}`
  );
  const spicaRcContent = {
    token: response.token,
    server: serverUrl
  };
  return await writeFile(getRcPath(), spicaRcContent).then(_ => "Successfully logged in.");
}

function getRcPath() {
  return path.join(os.homedir(), ".spicarc");
}

async function writeFile(fullPath: string, data: any): Promise<void> {
  const dirName = path.dirname(fullPath);
  await fs.promises.mkdir(dirName, {recursive: true});
  return await fs.promises.writeFile(fullPath, JSON.stringify(data));
}
