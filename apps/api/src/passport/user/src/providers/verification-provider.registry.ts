import {Injectable, BadRequestException} from "@nestjs/common";
import {VerificationProvider} from "@spica-server/interface/passport/user";

@Injectable()
export class VerificationProviderRegistry {
  private providers = new Map<string, VerificationProvider>();

  register(provider: VerificationProvider): void {
    if (this.providers.has(provider.name)) {
      throw new Error(`Provider with name '${provider.name}' is already registered`);
    }
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): VerificationProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new BadRequestException(
        `Verification provider '${name}' not found in available providers`
      );
    }
    return provider;
  }
}
