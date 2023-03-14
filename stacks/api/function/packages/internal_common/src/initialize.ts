import {ApikeyInitialization, IdentityInitialization, InitializationResult} from "./interface";
import {Axios} from "./request";

let service: Axios;

export function initialize(
  options: ApikeyInitialization | IdentityInitialization
): InitializationResult {
  let authorization: string;
  if ("apikey" in options) {
    authorization = `APIKEY ${options.apikey}`;
  } else if ("identity" in options) {
    authorization = `IDENTITY ${options.identity}`;
  }

  checkInitialized(authorization);

  const publicUrl = options.publicUrl || getPublicUrl();
  if (!publicUrl) {
    throw new Error("Public url must be provided.");
  }

  if (!service) {
    service = new Axios({baseURL: publicUrl, headers: {Authorization: authorization}});
  } else {
    service.setBaseUrl(publicUrl);
    service.setAuthorization(authorization);
  }

  if (options.interceptor) {
    service.attachInterceptor(options.interceptor);
  }

  return {authorization, publicUrl, service};
}

export function checkInitialized(authorization: string) {
  if (!authorization) {
    throw new Error("You should call initialize method with a valid apikey or identity token.");
  }
}

function getPublicUrl() {
  return isPlatformBrowser() ? undefined : process.env.__INTERNAL__SPICA__PUBLIC_URL__;
}

export function isPlatformBrowser() {
  return typeof window !== "undefined";
}
