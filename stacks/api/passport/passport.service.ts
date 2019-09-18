import {Collection, DatabaseService} from "@spica-server/database";
import {Inject, Injectable} from "@nestjs/common";
import {JwtService} from "@nestjs/jwt";
import {Identity} from "./identity";
import {PassportOptions, PASSPORT_OPTIONS} from "./interface";
import {compare, hash} from "./utils/hash";

@Injectable()
export class PassportService {
  private identityCollection: Collection<Identity>;

  constructor(
    database: DatabaseService,
    private jwt: JwtService,
    @Inject(PASSPORT_OPTIONS) private options: PassportOptions
  ) {
    this.identityCollection = database.collection("identity");
  }

  signIdentity(identity: Identity): string {
    delete identity.password;
    return this.jwt.sign(identity, {
      audience: this.options.audience,
      issuer: this.options.issuer,
      expiresIn: "2 days"
    });
  }

  identify(identifier: string, password: string): Promise<Identity | null> {
    return this.identityCollection.findOne({identifier}).then(identity => {
      if (identity) {
        return compare(password, identity.password).then(matched => {
          return matched ? identity : null;
        });
      }
      return null;
    });
  }

  default(identity: Identity) {
    return this.identityCollection.updateOne(
      {identifier: identity.identifier},
      {$setOnInsert: identity},
      {upsert: true}
    );
  }

  create(identity: Identity): Promise<Identity | null> {
    return hash(identity.password)
      .then(hashedPassword => {
        return this.identityCollection.insertOne({
          ...identity,
          password: hashedPassword
        });
      })
      .then(r => r.ops[0]);
  }
}
