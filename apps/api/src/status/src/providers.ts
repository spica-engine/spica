import {StatusProvider} from "../../../../../libs/interface/status";
import {providers} from "./controller";

export function register(provider: StatusProvider) {
  providers.add(provider);
}
