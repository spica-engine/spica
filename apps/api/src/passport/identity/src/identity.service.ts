import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {
  Identity,
  IDENTITY_OPTIONS,
  IdentityOptions
} from "@spica-server/interface/passport/identity";
import {Validator} from "@spica-server/core/schema";
import {Default} from "@spica-server/interface/core";
import {hash, compare} from "./hash";
import {JwtService, JwtSignOptions} from "@nestjs/jwt";

@Injectable()
export class IdentityService extends BaseCollection<Identity>("identity") {
  constructor(
    database: DatabaseService,
    private validator: Validator,
    private jwt: JwtService,
    @Inject(IDENTITY_OPTIONS) private identityOptions: IdentityOptions
  ) {
    super(database, {
      entryLimit: identityOptions.entryLimit,
      afterInit: () => this._coll.createIndex({identifier: 1}, {unique: true})
    });
  }

  getPredefinedDefaults(): Default[] {
    return this.validator.defaults;
  }

  sign(identity: Identity, requestedExpires?: number) {
    let expiresIn = this.identityOptions.expiresIn;
    if (requestedExpires) {
      expiresIn = Math.min(requestedExpires, this.identityOptions.maxExpiresIn);
    }

    type CustomJwtHeader = JwtSignOptions["header"] & {
      identifier?: string;
      policies?: string[];
    };

    const token = this.jwt.sign(
      {...identity, password: undefined},
      {
        header: {
          identifier: identity.identifier,
          policies: identity.policies
        } as CustomJwtHeader,
        expiresIn
      }
    );

    return {
      scheme: "IDENTITY",
      token,
      issuer: "passport/identity"
    };
  }

  verify(token: string) {
    return this.jwt.verifyAsync(token);
  }

  async identify(identifier: string, password: string): Promise<Identity | null> {
    if (!password) {
      return null;
    }
    const identity = await this.findOne({identifier});

    if (identity) {
      const matched = await compare(password, identity.password);
      return matched ? identity : null;
    }
    return null;
  }

  // @internal
  async default(identity: Identity): Promise<void> {
    const hashedPassword = await hash(identity.password);
    await this.updateOne(
      {identifier: identity.identifier},
      {$setOnInsert: {...identity, password: hashedPassword}},
      {upsert: true}
    );
  }
}
