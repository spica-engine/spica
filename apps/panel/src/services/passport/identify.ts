import axios from "axios";

export type IdentifyParams = {
  identifier: string;
  password: string;
};

const BASE_URL = import.meta.env.VITE_BASE_URL;

const apiClient = axios.create({
  baseURL: BASE_URL
});

export async function authorization(
  identityOrStrategy: IdentifyParams | string,
  openCallback?: (url: string) => void
): Promise<any> {
  if (typeof identityOrStrategy !== "string") {
    return apiClient.post(`/passport/identify`, identityOrStrategy);
  }
  //Login with strategy part
  const strategy = identityOrStrategy;
  const strategyRes = await apiClient.get(`/passport/strategy/${strategy}/url`, {
    params: {identityOrStrategy: strategy}
  });

  if (openCallback) openCallback(strategyRes.data.url);

  return apiClient.get("/passport/identify", {
    params: {state: strategyRes.data.state}
  });
}
