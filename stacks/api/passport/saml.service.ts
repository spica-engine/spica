import * as saml2 from "saml2-js";
import * as uuid from "uuid/v4";
import {SamlStrategy} from "./interface";
import {Injectable} from "@nestjs/common";
import {StrategyService} from "./strategies/strategy.service";

@Injectable()
export class SamlService {
  constructor(private strategy: StrategyService) {}

  async createMetadata(name: string): Promise<string | null> {
    const strategy = await this.getStrategy(name);
    if (!strategy) {
      return null;
    }
    const providers = this.getProviders(strategy);
    return providers.sp.create_metadata();
  }

  getStrategy(name: string): Promise<SamlStrategy | null> {
    return this.strategy.findOne<SamlStrategy>({name, type: "saml"});
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
      entity_id: `${process.env.PUBLIC_HOST}/passport/strategy/${strategy.name}`,
      assert_endpoint: state
        ? `${process.env.PUBLIC_HOST}/passport/strategy/${strategy.name}/complete?state=${state}`
        : `${process.env.PUBLIC_HOST}/passport/strategy/${strategy.name}/complete`,
      allow_unencrypted_assertion: true,
      certificate: strategy.options.sp.certificate,
      private_key: strategy.options.sp.private_key,
      force_authn: true,
      nameid_format: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent"
    });

    return {idp, sp};
  }
}
