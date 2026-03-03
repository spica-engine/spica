import {Injectable, OnModuleDestroy} from "@nestjs/common";
import {Validator} from "@spica-server/core/schema";
import {PasswordPolicy} from "@spica-server/interface/config";
import {IdentityConfigSettings} from "@spica-server/interface/passport/identity";
import {Observable, ReplaySubject, Subject, merge, defer} from "rxjs";
import {map, takeUntil} from "rxjs/operators";
import {IdentityConfigService} from "./config.service";

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
export class IdentityPasswordPolicySchemaResolver implements OnModuleDestroy {
  private configWatcher: ReplaySubject<IdentityConfigSettings>;
  private onDestroySubject = new Subject<void>();
  private schemaMap: Map<string, object>;

  constructor(
    private configService: IdentityConfigService,
    schemas: Map<string, object>
  ) {
    this.schemaMap = schemas;

    const initial$ = defer(() =>
      this.configService.get().then(config => {
        return (config?.options as IdentityConfigSettings) || {};
      })
    );

    const changes$ = this.configService.watchConfig();

    this.configWatcher = new ReplaySubject<IdentityConfigSettings>(1);

    merge(initial$, changes$).pipe(takeUntil(this.onDestroySubject)).subscribe(this.configWatcher);
  }

  onModuleDestroy() {
    this.onDestroySubject.next();
    this.onDestroySubject.complete();
  }

  resolve(uri: string): Observable<object> | undefined {
    const baseSchema = this.schemaMap.get(uri);
    if (!baseSchema) {
      return undefined;
    }

    return this.configWatcher.pipe(
      map(config => {
        const policy = config?.password;
        return applyPasswordPolicy(baseSchema, policy);
      })
    );
  }
}

export function provideIdentityPasswordPolicySchemaResolver(
  validator: Validator,
  configService: IdentityConfigService,
  schemas: {[uri: string]: object}
): IdentityPasswordPolicySchemaResolver {
  const schemaMap = new Map<string, object>();

  for (const [uri, baseSchema] of Object.entries(schemas)) {
    schemaMap.set(uri, baseSchema);
    validator.removeSchema(uri);
  }

  const resolver = new IdentityPasswordPolicySchemaResolver(configService, schemaMap);
  validator.registerUriResolver(uri => resolver.resolve(uri));

  return resolver;
}
