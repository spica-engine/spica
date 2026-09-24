import axios from "axios";
import {SyncHttpClient} from "@spica-server/sync";

export interface SpicaConnection {
  /** Spica API base url, e.g. "https://example.hq.spicaengine.com/api". */
  url: string;
  /** Authorization header value, e.g. "APIKEY <key>" or "IDENTITY <token>". */
  authorization: string;
}

export class SpicaRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly data?: unknown
  ) {
    super(message);
    this.name = "SpicaRequestError";
  }
}

export function createHttpClient({url, authorization}: SpicaConnection): SyncHttpClient {
  const instance = axios.create({baseURL: url.endsWith("/") ? url : `${url}/`});
  instance.defaults.headers.common["Authorization"] = authorization;
  instance.interceptors.response.use(
    response => response.data,
    error => Promise.reject(toRequestError(error))
  );
  return instance as unknown as SyncHttpClient;
}

// Axios errors carry circular request/response references and the Authorization
// header; callers persist and log these errors, so flatten them first.
function toRequestError(error: any): SpicaRequestError {
  const status: number | undefined = error?.response?.status;
  const data = error?.response?.data;
  const detail =
    (data && typeof data === "object" && (data.message || data.error)) ||
    (typeof data === "string" ? data : undefined) ||
    error?.message;
  const text = typeof detail === "string" ? detail : JSON.stringify(detail);
  const message = status != null ? `${status}: ${text}` : text || "request failed";
  return new SpicaRequestError(message, status, data);
}
