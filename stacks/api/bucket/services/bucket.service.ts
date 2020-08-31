import {Injectable} from "@nestjs/common";
import {Default, Validator} from "@spica-server/core/schema";
import {BaseCollection, Collection, DatabaseService} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference/services";
import {Bucket, BucketPreferences} from "./bucket";

@Injectable()
export class BucketService extends BaseCollection<Bucket>("buckets") {
  readonly buckets: Collection<Bucket>;

  constructor(db: DatabaseService, private pref: PreferenceService, private validator: Validator) {
    super(db);
  }

  getPreferences() {
    return this.pref.get<BucketPreferences>("bucket");
  }

  getPredefinedDefaults(): Default[] {
    return this.validator.defaults;
  }
}
