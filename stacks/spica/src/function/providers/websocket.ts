import {FunctionOptions} from "../interface";
export function provideWsInterceptor(options: FunctionOptions): string {
  let baseUrl = options.url.startsWith("http") ? options.url : window.location.origin + options.url;
  return baseUrl.replace("http", "ws");
}
