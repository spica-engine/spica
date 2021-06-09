import {FunctionOptions} from "../interface";

export function provideBaseurlInterceptor(options: FunctionOptions) {
  return options.url.startsWith("http") ? options.url : window.location.origin + options.url;
}
