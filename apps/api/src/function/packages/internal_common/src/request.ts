import {HttpService} from "@spica-server/interface/function/packages";
import axios, {AxiosRequestConfig, AxiosInstance, AxiosResponse} from "axios";

export function logWarning(response: any) {
  const warning = response.headers["warning"];
  if (warning) {
    console.warn(warning);
  }
}

export class Axios implements HttpService {
  private instance: AxiosInstance;
  baseUrl: string;

  private readonly interceptors = {
    request: {
      onFulfilled: (
        request: Omit<AxiosRequestConfig, "headers"> & {
          headers: any; // headers type from axios 0.x.x
        }
      ) => {
        request.maxBodyLength = Number.MAX_SAFE_INTEGER;
        request.maxContentLength = Number.MAX_SAFE_INTEGER;

        if (!request.headers["Authorization"]) {
          throw new Error(
            "You should call initialize method with a valid apikey or identity token."
          );
        }
        return request;
      },
      onRejected: (error: any) => {
        return Promise.reject(error);
      }
    },
    response: {
      onFulfilled: (response: AxiosResponse) => {
        logWarning(response);
        return response.data;
      },
      onRejected: (error: any) => {
        return Promise.reject(error.response ? error.response.data : error);
      }
    }
  };

  constructor(config: AxiosRequestConfig) {
    this.instance = axios.create(config);

    this.instance.interceptors.request.use(
      this.interceptors.request.onFulfilled,
      this.interceptors.request.onRejected
    );

    this.instance.interceptors.response.use(
      this.interceptors.response.onFulfilled,
      this.interceptors.response.onRejected
    );

    this.baseUrl = this.instance.defaults.baseURL;
    this.instance.defaults.paramsSerializer = paramsSerializer;
  }

  setBaseUrl(url: string) {
    this.instance.defaults.baseURL = url;
  }

  setWriteDefaults(writeDefaults: {headers: {[key: string]: string}}) {
    for (const [header, value] of Object.entries(writeDefaults.headers)) {
      this.instance.defaults.headers.post[header] = value;
      this.instance.defaults.headers.put[header] = value;
    }
  }

  setAuthorization(authorization: string) {
    this.instance.defaults.headers["Authorization"] = authorization;
  }

  getAuthorization() {
    return this.instance.defaults.headers["Authorization"].toString();
  }

  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.get(url, config);
  }

  post<T>(url: string, body: any, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.post(url, body, config);
  }

  put<T>(url: string, body: any, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.put(url, body, config);
  }

  patch<T>(url: string, body: any, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.patch(url, body, config);
  }

  delete(url: string, config?: AxiosRequestConfig): Promise<any> {
    return this.instance.delete(url, config);
  }

  request<T>(config: AxiosRequestConfig): Promise<T> {
    return this.instance.request(config);
  }
}

// It's because axios switched from encodeURIComponent to URLSearchParams with version 1.x

function encode(val) {
  return encodeURIComponent(val)
    .replace(/%3A/gi, ":")
    .replace(/%24/g, "$")
    .replace(/%2C/gi, ",")
    .replace(/%20/g, "+")
    .replace(/%5B/gi, "[")
    .replace(/%5D/gi, "]");
}

function utilsIsURLSearchParams(val) {
  return typeof URLSearchParams !== "undefined" && val instanceof URLSearchParams;
}

function utilsIsArray(val) {
  return toString.call(val) === "[object Array]";
}

function utilsIsDate(val) {
  return toString.call(val) === "[object Date]";
}

function utilsIsObject(val) {
  return val !== null && typeof val === "object";
}

function utilsForEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === "undefined") {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== "object") {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (utilsIsArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

/**
 * Build a queryString as Axios v0.21.4 would do
 *
 * @param {object} [params] The params to be appended
 * @returns {string} The serialized params
 */
function paramsSerializer(params) {
  if (utilsIsURLSearchParams(params)) {
    return params.toString();
  }

  var parts = [];

  utilsForEach(params, function serialize(val, key) {
    if (val === null || typeof val === "undefined") {
      return;
    }

    if (utilsIsArray(val)) {
      key = key + "[]";
    } else {
      val = [val];
    }

    utilsForEach(val, function parseValue(v) {
      if (utilsIsDate(v)) {
        v = v.toISOString();
      } else if (utilsIsObject(v)) {
        v = JSON.stringify(v);
      }
      parts.push(encode(key) + "=" + encode(v));
    });
  });

  return parts.join("&");
}
