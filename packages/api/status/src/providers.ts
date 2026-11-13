import {StatusProvider} from "@spica-server/interface-status";

export const providers = new Map<string, StatusProvider>();

export function register(provider: StatusProvider) {
  providers.set(provider.module, provider);
}
