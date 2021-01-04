import {ApikeyInitialization, IdentityInitialization, InitializationResult} from "./interface";

export function initialize(
  options: ApikeyInitialization | IdentityInitialization
): InitializationResult {
  let authorization;
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

  return {authorization, publicUrl};
}

export function checkInitialized(authorization: string) {
  if (!authorization) {
    throw new Error("You should call initialize method with a valid apikey or identity token.");
  }
}

function getPublicUrl() {
  //@ts-ignore
  return isPlatformBrowser() ? undefined : process.env.__INTERNAL__SPICA__PUBLIC_URL__;
}

export function isPlatformBrowser() {
  return typeof window !== "undefined";
}
