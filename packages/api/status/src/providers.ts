import {StatusProvider} from "@spica-server/interface-status";
import {providers} from "./controller.js";

export function register(provider: StatusProvider) {
  providers.set(provider.module, provider);
}
