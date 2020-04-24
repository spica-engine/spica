import {Injectable} from "@nestjs/common";
import {Default, Validator} from "@spica-server/core/schema";
import {BaseCollection, Collection, DatabaseService} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference/services";
import * as fs from "fs";
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

  findTemplates() {
    let templates = {};
    fs.readdirSync(`${__dirname}/templates`).forEach(f => {
      const file = fs.readFileSync(`${__dirname}/templates/${f}`, "utf8");
      const parsedFile = JSON.parse(file);
      templates[parsedFile.title] = parsedFile;
    });

    return templates;
  }

  async createFromTemplate(template) {
    // TODO(thesayyn): Implement proper logic w/ AJV
  }
}
