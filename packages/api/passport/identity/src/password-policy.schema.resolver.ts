import {Injectable, OnModuleDestroy} from "@nestjs/common";
import {Validator, applyPasswordPolicy} from "@spica-server/core-schema";
import {IdentityConfigSettings} from "@spica-server/interface/passport/identity";
import {Observable, ReplaySubject, Subject, merge, defer} from "rxjs";
import {map, takeUntil} from "rxjs/operators";
import {IdentityConfigService} from "./config.service.js";

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
