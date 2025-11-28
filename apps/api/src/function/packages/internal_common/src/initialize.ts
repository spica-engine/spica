import {
  ApikeyInitialization,
  HttpService,
  IdentityInitialization,
  InitializationResult,
  UserInitialization
} from "@spica-server/interface/function/packages";
import {Axios} from "./request";

let service: Axios;

export function initialize(
  options: ApikeyInitialization | IdentityInitialization | UserInitialization
): InitializationResult {
  let authorization: string;
  if ("apikey" in options) {
    authorization = `APIKEY ${options.apikey}`;
  } else if ("identity" in options) {
    authorization = `IDENTITY ${options.identity}`;
  } else if ("user" in options) {
    authorization = `USER ${options.user}`;
  }

  const publicUrl = options.publicUrl || getPublicUrl();
  if (!publicUrl) {
    throw new Error("Public url must be provided.");
  }

  if (!service) {
    service = new Axios({});
  }
  service.setBaseUrl(publicUrl);
  if (authorization) {
    service.setAuthorization(authorization);
  }

  return {authorization, publicUrl, service};
}

export function checkInitialized(
  authorization: string,
  service: HttpService,
  options: {skipAuthCheck: boolean} = {skipAuthCheck: false}
) {
  if (!authorization && !options.skipAuthCheck) {
    throw new Error("You should call initialize method with a valid credentials.");
  }

  if (!service) {
    throw new Error("You should call initialize method with a valid publicUrl.");
  }
}

function getPublicUrl() {
  return isPlatformBrowser() ? undefined : process.env.__INTERNAL__SPICA__PUBLIC_URL__;
}

export function isPlatformBrowser() {
  return typeof window !== "undefined";
}
