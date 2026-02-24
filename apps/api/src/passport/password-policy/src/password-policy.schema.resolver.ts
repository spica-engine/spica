import {Injectable, OnModuleDestroy} from "@nestjs/common";
import {ConfigService} from "@spica-server/config";
import {Validator} from "@spica-server/core/schema";
import {PasswordPolicy, PassportPasswordConfigOptions} from "@spica-server/interface/config";
import {Observable, Subject, merge, of, defer} from "rxjs";
import {map, shareReplay, takeUntil} from "rxjs/operators";

export function applyPasswordPolicy(baseSchema: object, policy?: PasswordPolicy): object {
  const schema = JSON.parse(JSON.stringify(baseSchema));

  if (!policy || !schema["properties"]?.["password"]) {
    return schema;
  }

  const passwordProp = schema["properties"]["password"];

  if (policy.minLength && policy.minLength > 0) {
    passwordProp["minLength"] = policy.minLength;
  }

  const lookaheads: string[] = [];

  if (policy.minLowercase && policy.minLowercase > 0) {
    lookaheads.push(`(?=(?:.*[a-z]){${policy.minLowercase}})`);
  }

  if (policy.minUppercase && policy.minUppercase > 0) {
    lookaheads.push(`(?=(?:.*[A-Z]){${policy.minUppercase}})`);
  }

  if (policy.minNumber && policy.minNumber > 0) {
    lookaheads.push(`(?=(?:.*\\d){${policy.minNumber}})`);
  }

  if (policy.minSpecialCharacter && policy.minSpecialCharacter > 0) {
    lookaheads.push(`(?=(?:.*[^a-zA-Z\\d\\s]){${policy.minSpecialCharacter}})`);
  }

  if (lookaheads.length > 0) {
    passwordProp["pattern"] = `^${lookaheads.join("")}.*$`;
  }

  return schema;
}

@Injectable()
export class PasswordPolicySchemaResolver implements OnModuleDestroy {
  private configWatcher: Observable<PassportPasswordConfigOptions>;
  private onDestroySubject = new Subject<void>();
  private schemaMap: Map<string, {baseSchema: object; configKey: "identity" | "user"}>;

  constructor(
    private configService: ConfigService,
    schemas: Map<string, {baseSchema: object; configKey: "identity" | "user"}>
  ) {
    this.schemaMap = schemas;

    const initial$ = defer(() =>
      this.configService.findOne({module: "passport"}).then(config => {
        return (config?.options as PassportPasswordConfigOptions) || {};
      })
    );

    const changes$ = this.configService
      .watch([{$match: {"fullDocument.module": "passport"}}], {fullDocument: "updateLookup"})
      .pipe(
        map(
          change => ((change as any).fullDocument?.options as PassportPasswordConfigOptions) || {}
        )
      );

    this.configWatcher = merge(initial$, changes$).pipe(
      takeUntil(this.onDestroySubject),
      shareReplay(1)
    );
  }

  onModuleDestroy() {
    this.onDestroySubject.next();
    this.onDestroySubject.complete();
  }

  resolve(uri: string): Observable<object> | undefined {
    const entry = this.schemaMap.get(uri);
    if (!entry) {
      return undefined;
    }

    return this.configWatcher.pipe(
      map(config => {
        const policy = config?.[entry.configKey]?.password;
        return applyPasswordPolicy(entry.baseSchema, policy);
      })
    );
  }
}

export function providePasswordPolicySchemaResolver(
  validator: Validator,
  configService: ConfigService,
  schemas: {[uri: string]: {baseSchema: object; configKey: "identity" | "user"}}
): PasswordPolicySchemaResolver {
  const schemaMap = new Map<string, {baseSchema: object; configKey: "identity" | "user"}>();

  for (const [uri, entry] of Object.entries(schemas)) {
    schemaMap.set(uri, entry);
    validator.removeSchema(uri);
  }

  const resolver = new PasswordPolicySchemaResolver(configService, schemaMap);
  validator.registerUriResolver(uri => resolver.resolve(uri));

  return resolver;
}
