import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Identity} from "./interface";
import {Validator, Default} from "@spica-server/core/schema";
import {hash, compare} from "./hash";
import {JwtService} from "@nestjs/jwt";
import {IDENTITY_OPTIONS, IdentityOptions} from "./options";

@Injectable()
export class IdentityService extends BaseCollection<Identity>("identity") {
  constructor(
    database: DatabaseService,
    private validator: Validator,
    private jwt: JwtService,
    @Inject(IDENTITY_OPTIONS) options: IdentityOptions
  ) {
    super(database, options.identityCountLimit);
    this._coll.createIndex({identifier: 1}, {unique: true});
  }

  getPredefinedDefaults(): Default[] {
    return this.validator.defaults;
  }

  sign(identity: Identity) {
    const token = this.jwt.sign(
      {...identity, password: undefined},
      {
        header: {
          identifier: identity.identifier,
          policies: identity.policies
        }
      }
    );

    return {
      scheme: "IDENTITY",
      token,
      issuer: "passport/identity"
    };
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
