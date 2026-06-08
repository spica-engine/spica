import axios, {AxiosInstance, AxiosRequestConfig} from "axios";
import {ApiKeyInfo, CreateApiKeyOptions} from "./interface";

/**
 * Minimal shape of the client expected by the CLI sync engine (buildPlan/applyPlan):
 * every verb resolves to the unwrapped response body.
 */
export type HttpClient = {
  get<R>(url: string, config?: AxiosRequestConfig): Promise<R>;
  delete<R>(url: string, config?: AxiosRequestConfig): Promise<R>;
  head<R>(url: string, config?: AxiosRequestConfig): Promise<R>;
  post<R>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R>;
  patch<R>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R>;
  put<R>(url: string, data?: any, config?: AxiosRequestConfig): Promise<R>;
};

/**
 * Build an axios client whose interceptor unwraps `response.data`, mirroring
 * apps/cli/src/http.ts so it is a drop-in for the CLI sync engine.
 */
export function createClient(baseUrl: string, authorization: string): HttpClient {
  const instance: AxiosInstance = axios.create({baseURL: baseUrl});
  instance.interceptors.response.use(
    response => response.data,
    error => {
      if (!error.response) {
        return Promise.reject(error);
      }
      return Promise.reject(error.response.data || error.response);
    }
  );
  instance.defaults.headers.common["Authorization"] = authorization;
  return instance as unknown as HttpClient;
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Collaborator object holding the api-level operations start() depends on.
 * Exposed as an object (not bare named exports) so tests can spy on each method.
 */
export const api = {
  /** Poll GET <url>/status/ready until it returns 2xx or the timeout elapses. */
  async waitForReady(url: string, timeoutMs = 120_000, intervalMs = 1000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    while (Date.now() < deadline) {
      try {
        const res = await axios.get(`${url}/status/ready`, {
          // never throw on status - we decide based on the code
          validateStatus: () => true,
          timeout: intervalMs
        });
        if (res.status >= 200 && res.status < 300) {
          return;
        }
        lastError = new Error(`status ${res.status}`);
      } catch (e) {
        lastError = e;
      }
      await sleep(intervalMs);
    }
    throw new Error(
      `Spica api at ${url} did not become ready within ${timeoutMs}ms. Last error: ${String(
        lastError
      )}`
    );
  },

  /** Log in via POST /passport/identify and return the IDENTITY token. */
  async login(
    url: string,
    identifier: string,
    password: string,
    expires?: number
  ): Promise<string> {
    const res = await axios.post(`${url}/passport/identify`, {identifier, password, expires});
    const token = res.data && res.data.token;
    if (!token) {
      throw new Error(`Login for "${identifier}" did not return a token.`);
    }
    return token;
  },

  /** Create an api key and, by default, attach every policy so it has full access. */
  async createApiKey(
    client: HttpClient,
    name: string,
    options: CreateApiKeyOptions = {}
  ): Promise<ApiKeyInfo> {
    const {fullAccess = true, policies = []} = options;
    const created = await client.post<ApiKeyInfo & {policies?: string[]}>("passport/apikey", {
      name,
      active: true
    });

    const policyIds = new Set<string>(policies);
    if (fullAccess) {
      const all = await client.get<any>("passport/policy");
      const list: Array<{_id: string}> = Array.isArray(all) ? all : (all && all.data) || [];
      for (const policy of list) {
        policyIds.add(policy._id);
      }
    }

    for (const policyId of policyIds) {
      await client.put(`passport/apikey/${created._id}/policy/${policyId}`, {});
    }

    return {_id: created._id, name: created.name, key: created.key};
  }
};
