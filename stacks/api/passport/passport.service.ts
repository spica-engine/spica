import {Collection, DatabaseService, ObjectId, FilterQuery} from "@spica-server/database";
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

  getIdentity(filter: FilterQuery<Identity>): Promise<Identity> {
    return this.identityCollection.findOne(filter);
  }

  getIdentities(aggregate?: any): Promise<any[]> {
    return this.identityCollection.aggregate(aggregate).toArray();
  }

  update(id: ObjectId, identity: Partial<Identity>): Promise<boolean> {
    const i = {...identity};
    if (i.password) {
      hash(i.password).then(hashedPass => {
        i.password = hashedPass;
        return this.identityCollection.updateOne({_id: id}, {$set: i}).then(r => r.result.ok > 0);
      });
    } else {
      delete i.password;
      return this.identityCollection.updateOne({_id: id}, {$set: i}).then(r => r.result.ok > 0);
    }
  }

  signIdentity(identity: Identity): string {
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

  insertOne(identity: Identity): Promise<Identity> {
    return this.identityCollection.insertOne(identity).then(res => res.ops[0]);
  }

  deleteOne(filter: Object): Promise<any> {
    return this.identityCollection.deleteOne(filter);
  }

  default(identity: Identity) {
    return this.identityCollection.updateOne(
      {identifier: identity.identifier},
      {$setOnInsert: identity},
      {upsert: true}
    );
  }
}
