import {Injectable} from "@nestjs/common";
import {BucketService, compile} from "@spica-server/bucket/services";
import {BucketPreferences, Bucket} from "@spica-server/bucket/services/bucket";
import {Validator} from "@spica-server/core/schema";
import {ObjectId} from "@spica-server/database";
import {map} from "rxjs/operators";
import {combineLatest, Observable} from "rxjs";

@Injectable()
export class BucketSchemaResolver {
  preferenceWatcher: Observable<BucketPreferences>;
  bucketWatchers: Map<string, Observable<Bucket>> = new Map();
  constructor(private bucketService: BucketService) {
    this.preferenceWatcher = this.bucketService.watchPreferences(true);
  }

  resolve(uri: string): Observable<object> {
    if (ObjectId.isValid(uri)) {
      let bucketWatcher = this.bucketWatchers.get(uri);
      if (!bucketWatcher) {
        bucketWatcher = this.bucketService.watch(uri, true);
        this.bucketWatchers.set(uri, bucketWatcher);
      }
      return combineLatest(this.preferenceWatcher, bucketWatcher).pipe(
        map(([prefs, schema]) => {
          let jsonSchema = compile(JSON.parse(JSON.stringify(schema)), prefs);
          jsonSchema.$id = uri;
          jsonSchema.$schema = "http://spica.internal/bucket/schema";
          jsonSchema.additionalProperties = false;
          jsonSchema.properties._schedule = {
            type: "string",
            format: "date-time"
          };
          return jsonSchema || {type: true};
        })
      );
    }
  }
}

export async function provideBucketSchemaResolver(validator: Validator, bs: BucketService) {
  const resolver = new BucketSchemaResolver(bs);
  validator.registerUriResolver(uri => resolver.resolve(uri));
  return resolver;
}
