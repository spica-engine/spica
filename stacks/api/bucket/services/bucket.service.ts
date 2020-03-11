import {Injectable} from "@nestjs/common";
import {Default, Validator} from "@spica-server/core/schema";
import {
  Collection,
  DatabaseService,
  DeleteWriteOpResultObject,
  FilterQuery,
  InsertOneWriteOpResult,
  InsertWriteOpResult,
  FindAndModifyWriteOpResultObject,
  FindOneAndReplaceOption
} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference";
import * as fs from "fs";
import {Bucket, BucketPreferences} from "./bucket";

@Injectable()
export class BucketService {
  readonly buckets: Collection<Bucket>;

  constructor(
    private db: DatabaseService,
    private pref: PreferenceService,
    private validator: Validator
  ) {
    this.buckets = this.db.collection<Bucket>("buckets");
  }

  getPreferences() {
    return this.pref.get<BucketPreferences>("bucket");
  }

  find(filter?: FilterQuery<Bucket>): Promise<Array<Bucket>> {
    return this.buckets
      .find(filter)
      .sort({order: 1})
      .toArray();
  }

  findOne(filter: FilterQuery<Bucket>): Promise<Bucket | null> {
    return this.buckets.findOne(filter);
  }

  insertOne(bucket: Bucket): Promise<InsertOneWriteOpResult> {
    return this.buckets.insertOne(bucket);
  }

  insertMany(buckets: Bucket[]): Promise<InsertWriteOpResult> {
    return this.buckets.insertMany(buckets);
  }

  replaceOne(
    filter: FilterQuery<Bucket>,
    bucket: Bucket,
    options: FindOneAndReplaceOption = {returnOriginal: false}
  ): Promise<FindAndModifyWriteOpResultObject> {
    return this.buckets.findOneAndReplace(filter, bucket, options);
  }

  updateOne(
    filter: FilterQuery<Bucket>,
    changes: object,
    options: FindOneAndReplaceOption = {returnOriginal: false}
  ): Promise<FindAndModifyWriteOpResultObject> {
    return this.buckets.findOneAndUpdate(filter, {$set: changes}, options);
  }

  deleteOne(filter: FilterQuery<Bucket>): Promise<DeleteWriteOpResultObject> {
    return this.buckets.deleteOne(filter);
  }

  deleteAll(): Promise<boolean> {
    return this.buckets.drop();
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
