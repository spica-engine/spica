import {Injectable} from "@nestjs/common";
import {Collection, DatabaseService, ObjectId, FilterQuery} from "@spica-server/database";
import {Identity, Service} from "./interface";
import {Default, Validator} from "@spica-server/core/schema";
import {hash} from "../utils/hash";

@Injectable()
export class IdentityService {
  private identityCollection: Collection<Identity>;

  managedIdentities: Array<IdentityWithType>;
  customerManagedIdentities: Array<IdentityWithType>;

  get identities(): Array<IdentityWithType> {
    return [...this.managedIdentities, ...this.customerManagedIdentities];
  }

  services: Array<Service> = [];

  constructor(
    db: DatabaseService,
    identities: Identity[],
    services: Service[],
    private validator: Validator
  ) {
    this.identityCollection = db.collection("identity");
    this.managedIdentities = identities.map(p => ({...p, system: true}));
    this.services = services;
  }

  findOne(filter: FilterQuery<Identity>): Promise<Identity> {
    return this.identityCollection.findOne(filter);
  }

  find(aggregate?: any): Promise<any[]> {
    return this.identityCollection.aggregate(aggregate).toArray();
  }

  updateOne(id: ObjectId, identity: Partial<Identity>): Promise<boolean> {
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

  insertOne(identity: Identity): Promise<Identity> {
    return this.identityCollection.insertOne(identity).then(res => res.ops[0]);
  }

  deleteOne(filter: Object): Promise<any> {
    return this.identityCollection.deleteOne(filter);
  }

  getPredefinedDefaults(): Default[] {
    return this.validator.defaults;
  }
}

type IdentityWithType = Identity & {system: boolean};
