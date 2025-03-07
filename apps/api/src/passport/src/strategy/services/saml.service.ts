import {Inject, Injectable, Optional} from "@nestjs/common";
import saml2 from "saml2-js";
import * as uuid from "uuid";
import {SamlStrategy, StrategyTypeService} from "../interface";
import {PassportOptions, PASSPORT_OPTIONS} from "../../options";
import {StrategyService} from "./strategy.service";
import forge from "node-forge";
import {ObjectId} from "@spica-server/database";

@Injectable()
export class SamlService implements StrategyTypeService {
  readonly type = "saml";

  constructor(
    private strategy: StrategyService,
    @Inject(PASSPORT_OPTIONS) private options: PassportOptions
  ) {}

  async createMetadata(id: string): Promise<string | null> {
    const strategy = await this.getStrategy(id);
    if (!strategy) {
      return null;
    }
    const providers = this.getProviders(strategy);
    return providers.sp.create_metadata();
  }

  getStrategy(id: string): Promise<SamlStrategy> {
    return this.strategy.findOne({_id: new ObjectId(id)}) as Promise<SamlStrategy>;
  }

  getLoginUrl(strategy: SamlStrategy): Promise<{url: string; state: string}> {
    const stateId = uuid.v4();
    const providers = this.getProviders(strategy, stateId);

    return new Promise((resolve, reject) =>
      providers.sp.create_login_request_url(providers.idp, {}, (error, url) =>
        error ? reject(error) : resolve({url, state: stateId})
      )
    );
  }

  assert(strategy: SamlStrategy, body: unknown) {
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
      entity_id: `${this.options.publicUrl}/passport/strategy/${strategy._id}`,
      assert_endpoint: state
        ? `${this.options.publicUrl}/passport/strategy/${strategy._id}/complete?state=${state}`
        : `${this.options.publicUrl}/passport/strategy/${strategy._id}/complete`,
      certificate: strategy.options.sp.certificate,
      private_key: strategy.options.sp.private_key,
      force_authn: true,
      nameid_format: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
      allow_unencrypted_assertion: true
    });

    return {idp, sp};
  }

  prepareToInsert(strategy: SamlStrategy) {
    try {
      forge.pki.certificateFromPem(strategy.options.ip.certificate);
    } catch (error) {
      throw Error(error);
    }

    if (strategy.options.sp) {
      try {
        const {validity} = forge.pki.certificateFromPem(strategy.options.sp.certificate);
        if (validity.notAfter < new Date()) {
          strategy.options.sp = undefined;
        }
      } catch {
        strategy.options.sp = undefined;
      }
    } else {
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const cert = forge.pki.createCertificate();
      const attrs: forge.pki.CertificateField[] = [
        {name: "commonName", value: "spica.io"},
        {name: "organizationName", value: "spica"}
      ];

      cert.publicKey = keys.publicKey;
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setSeconds(
        cert.validity.notBefore.getSeconds() + this.options.samlCertificateTTL
      );

      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.sign(keys.privateKey);
      strategy.options.sp = {
        certificate: forge.pki.certificateToPem(cert),
        private_key: forge.pki.privateKeyToPem(keys.privateKey)
      };
    }

    return strategy;
  }
}
