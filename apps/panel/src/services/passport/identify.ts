import axios from "axios";

export type IdentifyParams = {
  identifier: string;
  password: string;
};
export async function identify(
  identityOrStrategy: IdentifyParams | string,
  openCallback?: (url: string) => void
): Promise<any> {
  if (typeof identityOrStrategy !== "string") {
    return axios.post(`/api/passport/identify`, identityOrStrategy);
  }

  const strategy = identityOrStrategy;
  const res = await axios.get(`/api/passport/strategy/${strategy}/url`, {
    params: {identityOrStrategy: strategy}
  });

  if (openCallback) openCallback(res.data.url);

  return axios.get("/api/passport/identify", {
    params: {state: res.data.state}
  });
}
