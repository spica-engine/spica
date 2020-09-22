import {Inject, Injectable} from "@nestjs/common";
import * as saml2 from "saml2-js";
import * as uuid from "uuid/v4";
import {SamlStrategy} from "./strategy/interface";
import {PassportOptions, PASSPORT_OPTIONS} from "./options";
import {StrategyService} from "./strategy/strategy.service";

@Injectable()
export class SamlService {
  constructor(
    private strategy: StrategyService,
    @Inject(PASSPORT_OPTIONS) private options: PassportOptions
  ) {}

  async createMetadata(name: string): Promise<string | null> {
    const strategy = await this.getStrategy(name);
    if (!strategy) {
      return null;
    }
    const providers = this.getProviders(strategy);
    return providers.sp.create_metadata();
  }

  getStrategy(name: string): Promise<SamlStrategy | null> {
    return this.strategy.findOne({name, type: "saml"}) as Promise<SamlStrategy>;
  }

  async getLoginUrl(name: string): Promise<{url: string; state: string}> {
    const strategy = await this.getStrategy(name);
    if (!strategy) {
      return null;
    }

    const stateId = uuid();
    const providers = this.getProviders(strategy, stateId);

    return new Promise((resolve, reject) =>
      providers.sp.create_login_request_url(providers.idp, {}, (error, url) =>
        error ? reject(error) : resolve({url, state: stateId})
      )
    );
  }

  async assert(name: string, body: string) {
    const strategy = await this.getStrategy(name);
    if (!strategy) {
      return null;
    }

    const providers = this.getProviders(strategy);

    return new Promise((resolve, reject) =>
      providers.sp.post_assert(
        providers.idp,
        {
          request_body: body
        },
        (error, response) => (error ? reject(error) : resolve(response))
      )
    );
  }

  protected getProviders(strategy: SamlStrategy, state?: string) {
    const idp = new saml2.IdentityProvider({
      sso_login_url: strategy.options.ip.login_url,
      sso_logout_url: strategy.options.ip.logout_url,
      certificates: [strategy.options.ip.certificate]
    });

    const sp = new saml2.ServiceProvider({
      entity_id: `${this.options.publicUrl}/passport/strategy/${strategy.name}`,
      assert_endpoint: state
        ? `${this.options.publicUrl}/passport/strategy/${strategy.name}/complete?state=${state}`
        : `${this.options.publicUrl}/passport/strategy/${strategy.name}/complete`,
      certificate: strategy.options.sp.certificate,
      private_key: strategy.options.sp.private_key,
      force_authn: true,
      nameid_format: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
      allow_unencrypted_assertion: true
    });

    return {idp, sp};
  }
}
