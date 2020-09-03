import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Omit} from "@spica-client/core";
import * as jwt_decode from "jwt-decode";
import * as matcher from "matcher";
import {Observable, of} from "rxjs";
import {concatMap, map, shareReplay, tap} from "rxjs/operators";
import {Identity} from "../interfaces/identity";
import {Statement} from "../interfaces/statement";
import {Strategy} from "../interfaces/strategy";

export type IdentifyParams = Omit<Omit<Identity, "policies">, "attributes">;

@Injectable({providedIn: "root"})
export class PassportService {
  private _statements: Observable<Statement[]>;

  get token(): string {
    return localStorage.getItem("access_token");
  }
  set token(token: string) {
    localStorage.setItem("access_token", token);
  }

  get decodedToken(): Identity & {exp: number} {
    const decodedToken = this.token.replace(/\w*\s\b/g, "");
    return jwt_decode(decodedToken);
  }

  get expired(): boolean {
    return Date.now() / 1000 >= this.decodedToken.exp;
  }

  get identified(): boolean {
    return this.token !== null && !this.expired;
  }

  constructor(private http: HttpClient) {}

  logout(): void {
    localStorage.removeItem("access_token");
  }

  identify(identity: IdentifyParams): Observable<any> {
    return this.http.get(`api:/passport/identify`, {params: identity}).pipe(
      tap(response => {
        this.token = `${response.scheme} ${response.token}`;
        this._statements = undefined;
      })
    );
  }

  identifyWith(strategy: string, openCallback?: (url: string) => void): Observable<any> {
    return this.http
      .get<any>(`api:/passport/strategy/${strategy}/url`, {
        params: {strategy}
      })
      .pipe(
        concatMap(res => {
          if (openCallback) {
            openCallback(res.url);
          } else {
            window.open(res.url);
          }
          return this.http.get(`api:/passport/identify`, {params: {state: res.state}});
        }),
        tap(response => {
          this.token = response.token;
          this._statements = undefined;
        })
      );
  }

  getStrategies() {
    return this.http.get<Strategy[]>("api:/passport/strategies");
  }

  getStatements() {
    return this.http.get<Statement[]>("api:/passport/identity/statements");
  }

  checkAllowed(action: string, resource?: string): Observable<boolean> {
    if (!this._statements) {
      // To eliminate redundant requests
      this._statements = this.getStatements().pipe(shareReplay());
    }

    return this._statements.pipe(
      map(statements => {
        const actionParts = action.split(":");

        const resourceAndModule = {
          resource: resource ? resource.split("/") : [],
          module: actionParts.slice(0, actionParts.length - 1).join(":")
        };

        const include = [];
        const exclude = [];
        let result;

        for (const statement of statements) {
          const actionMatch = matcher.isMatch(action, statement.action);
          const moduleMatch = resourceAndModule.module == statement.module;
          
          if (actionMatch && moduleMatch) {
            let match: boolean;

            if (typeof statement.resource == "string" || Array.isArray(statement.resource)) {
              // Parse resources in such format bucketid/dataid thus we could match them individually
              const resources = wrapArray(statement.resource).map(resource => resource.split("/"));

              match = resources.some(resource =>
                // Match all the positional resources when accessing to bucket data endpoints where the resource looks like below
                // [ '5f30fffd4a51a68d6fec4d3b', '5f31002e4a51a68d6fec4d3f' ]
                // where the first element is the id of the bucket while the second item is the identifier of the document
                // hence all resources has to match in order to assume that the user has the access to a arbitrary resource
                //
                // IMPORTANT: when the resource definition is shorter than the resource present in the statement we only check parts
                // that are present in the resource definition. for example,  when the resource definiton is [ '5f30fffd4a51a68d6fec4d3b']
                // and resource in the statement is ["5f30fffd4a51a68d6fec4d3b", "5f31002e4a51a68d6fec4d3f"]
                // we only check definition.resource[0] against resource[0] in the statement and the rest will be passed as mongodb aggregation
                // to filter out in database layer.
                resourceAndModule.resource.every((part, index) => part == resource[index])
              );

              const leftOverResources = [];

              for (const resource of resources) {
                const leftOver = resource.slice(resourceAndModule.resource.length);
                // if ( leftOver.length > 1 ) {
                //   throw new ConflictException(
                //       `The policy ${policy.name} contains invalid resource name '${resource.join("/")}'.` +
                //       ` Resource ${resourceAndModule.module} ${action} only accepts ${resourceAndModule.resource.length} positional arguments.`
                //   );
                // }
                if (leftOver.length) {
                  leftOverResources.push(leftOver[0]);
                }
              }

              include.push(...leftOverResources);
            } else {
              const resource = statement.resource;
              // We need parse resources that has slash in it to match them individually.
              const includeParts = resource.include.split("/");

              match = resourceAndModule.resource.every((part, index) => {
                const pattern = [includeParts[index]];
                // We only include the excluded items when we are checking the last portion of the resource
                // which is usually the subresource
                if (index == resourceAndModule.resource.length - 1) {
                  pattern.push(
                    ...resource.exclude.map(resource => `!${resource.split("/")[index]}`)
                  );
                }
                return matcher.isMatch(part, pattern);
              });

              exclude.push(statement.resource.exclude);
            }

            // If the current resource has names we have to check them explicitly
            // otherwise we just pass those to controllers to filter out in database layer
            if (match && actionMatch && moduleMatch) {
              result = true;
              // Resource is allowed therefore we don't need to go further and check other policies.
              break;
            }
          }
        }

        return result;
      })
    );
  }
}

export function wrapArray(val: string | string[]) {
  return Array.isArray(val) ? val : Array(val);
}
