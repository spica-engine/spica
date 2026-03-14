import {StatusProvider} from "@spica-server/interface/status";
import {providers} from "./controller";

export function register(provider: StatusProvider) {
  providers.add(provider);
}
