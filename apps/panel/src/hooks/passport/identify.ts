import axios from "axios";
import {jwtDecode} from "jwt-decode";
export type IdentifyParams = {
  identifier: string;
  password: string;
};
export interface Identity {
  _id?: string;
  identifier: string;
  password: string;
  policies: string[];
  attributes?: {
    [key: string]: any;
  };
  system?: boolean;
  authFactor?: AuthFactorMeta;
  exp?: number;
}
export interface AuthFactorMeta {
  type: string;
  config: {
    [key: string]: any;
  };
  secret: string;
}

const BASE_URL = import.meta.env.VITE_BASE_URL;

const apiClient = axios.create({
  baseURL: BASE_URL
});

const useLocalStorage = () => {
  const setItem = (key: string, value: string) => {
    localStorage.setItem(key, value);
  };

  const getItem = (key: string): string | null => {
    return localStorage.getItem(key);
  };

  const removeItem = (key: string): void => {
    localStorage.removeItem(key);
  };

  const clear = (): void => {
    localStorage.clear();
  };

  const isValid = (): boolean => {
    const rawToken = localStorage.getItem("access_token");
    if (!rawToken) return false;

    const decodedToken = rawToken.replace(/\w*\s\b/g, "");
    console.log("Decoded Token:", decodedToken);

    const decoded = jwtDecode<Identity>(decodedToken);
    console.log("Decoded Identity:", decoded.exp);
    return decoded.exp ? Date.now() / 1000 < decoded.exp : false;
  };

  return {setItem, getItem, removeItem, clear, isValid};
};

export async function authorization(
  identityOrStrategy: IdentifyParams | string,
  openCallback?: (url: string) => void
): Promise<any> {
  if (typeof identityOrStrategy !== "string") {
    return apiClient.post(`/api/passport/identify`, identityOrStrategy);
  }
  //Login with strategy part
  const strategy = identityOrStrategy;
  const strategyRes = await apiClient.get(`/api/passport/strategy/${strategy}/url`, {
    params: {identityOrStrategy: strategy}
  });

  if (openCallback) openCallback(strategyRes.data.url);

  return apiClient.get("/api/passport/identify", {
    params: {state: strategyRes.data.state}
  });
}
export default useLocalStorage;
