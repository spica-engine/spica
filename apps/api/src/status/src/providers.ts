import {StatusProvider} from "./interface";
import {providers} from "./controller";

export function register(provider: StatusProvider) {
  providers.add(provider);
}
