import {Injectable, NotFoundException} from "@nestjs/common";
import {Bucket, BucketPreferences, BucketService, compile} from "@spica/api/src/bucket/services";
import {CodeKeywordDefinition, KeywordCxt, Validator, _} from "@spica/core";
import {ObjectId} from "@spica/database";
import {combineLatest, Observable} from "rxjs";
import {map} from "rxjs/operators";

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
      return combineLatest([this.preferenceWatcher, bucketWatcher]).pipe(
        map(([prefs, schema]) => {
          // controller will handle the throwing error message when bucket does not exist
          if (!schema) {
            return {};
          }

          let jsonSchema = compile(schema, prefs);
          jsonSchema.$id = uri;
          return jsonSchema;
        })
      );
    }
  }
}

export function provideBucketSchemaResolver(validator: Validator, bs: BucketService) {
  const resolver = new BucketSchemaResolver(bs);
  validator.registerUriResolver(uri => resolver.resolve(uri));
  return resolver;
}

export const bucketSpecificDefault: CodeKeywordDefinition = {
  keyword: "default",
  before: "format",
  code(cxt: KeywordCxt, ruleType?: string) {
    const {gen, data, schema, parentSchema, it} = cxt;
    const {opts, parentData, parentDataProperty} = it;
    const defaults = opts["defaults"];

    // TODO: make this work in a seperate keyword
    if (parentSchema && parentSchema.readOnly) {
      const defaultValue = gen.scopeValue("obj", {
        ref: parentSchema.default
      });
      gen.block(_`${data} = ${parentData}[${parentDataProperty}] = ${defaultValue}`);
    }

    if (defaults.has(schema)) {
      // TODO: investigate why rule type is empty
      //if (defaulter.type != ruleType) return;
      const defsRef = gen.scopeValue("obj", {
        ref: opts["defaults"]
      });
      const defRef = gen.const("defRef", _`${defsRef}.get(${schema})`);
      gen.block(
        _`${data} = ${parentData}[${parentDataProperty}] = ${defRef}.create(${data} == ${schema} ? undefined : ${data})`
      );
    }
  }
};
