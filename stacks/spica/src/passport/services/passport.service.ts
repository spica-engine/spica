import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import jwt_decode from "jwt-decode";
import * as matcher from "matcher";
import {Observable} from "rxjs";
import {concatMap, map, shareReplay} from "rxjs/operators";
import {Identity} from "../interfaces/identity";
import {Statement} from "../interfaces/statement";
import {Strategy} from "../interfaces/strategy";

export type IdentifyParams = {identifier: string; password: string};

@Injectable({providedIn: "root"})
export class PassportService {
  private _statements: Observable<Statement[]>;

  get token(): string {
    return localStorage.getItem("access_token");
  }
  set token(token: string) {
    localStorage.setItem("access_token", token);
  }

  get decodedToken(): Identity & {exp: number, iat: number} {
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
    localStorage.removeItem("next_token_refresh_date");
  }

  unidentify(){
    return this.http.get<any>("api:/passport/unidentify", {withCredentials: true});
  }

  onTokenRecieved(response) {
    this.token = `${response.scheme} ${response.token}`;
    this._statements = undefined;
    if(!this.getNextTokenRefreshDate()){
      this.setNextTokenRefreshDate();
    }
  }

  getNextTokenRefreshDate() {
    return localStorage.getItem("next_token_refresh_date")
  }

  setNextTokenRefreshDate() {
    const now = new Date();
    const minutes = this.getTokenExpMin() - 1;
    const date = now.setMinutes(now.getMinutes() + minutes)
    localStorage.setItem("next_token_refresh_date", new Date(date).toString())
  }

  getTokenExpMin() {
    const iat = this.decodedToken.iat * 1000;
    const exp = this.decodedToken.exp * 1000;

    const differenceInMilliseconds = Math.abs(exp - iat);
    return differenceInMilliseconds / (1000 * 60);
  }

  answerAuthFactor(factor, answer) {
    return this.http.post(`api:/${factor.answerUrl}`, {
      answer
    },  {withCredentials: true});
  }

  identify(identityOrStrategy: IdentifyParams | string, openCallback?: (url: string) => void) {
    if (typeof identityOrStrategy != "string") {
      return this.http.post<any>("api:/passport/identify", identityOrStrategy, {withCredentials: true});
    }

    return this.http
      .get<any>(`api:/passport/strategy/${identityOrStrategy}/url`, {
        params: {identityOrStrategy}
      })
      .pipe(
        concatMap(res => {
          openCallback(res.url);
          return this.http.get(`api:/passport/identify`, {params: {state: res.state}});
        })
      );
  }

  refreshToken() {
    return this.http.get<any>("api:/passport/refresh-token", {withCredentials: true});
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

        let hasResourceFilter =
          resourceAndModule.resource.lastIndexOf("*") == resourceAndModule.resource.length - 1;

        if (hasResourceFilter) {
          resourceAndModule.resource.splice(resourceAndModule.resource.length - 1, 1);
        }

        let result;

        for (const statement of statements) {
          const actionMatch = action == statement.action;
          const moduleMatch = resourceAndModule.module == statement.module;

          if (actionMatch && moduleMatch) {
            let match: boolean;

            if (typeof statement.resource == "object") {
              //INCLUDE THESE
              if (!statement.resource.exclude.length) {
                // Parse resources in such format bucketid/dataid thus we could match them individually
                const resources = wrapArray(statement.resource.include).map(resource =>
                  resource.split("/")
                );

                match = resources.some(resource =>
                  // Match all the positional resources when accessing to bucket data endpoints where the resource looks like below
                  // [ '5f30fffd4a51a68d6fec4d3b', '5f31002e4a51a68d6fec4d3f' ]
                  // and the first element is the id of the bucket while the second item is the identifier of the document
                  // hence all resources has to match in order to assume that the user has the access to an arbitrary resource
                  //
                  // IMPORTANT: when the resource definition is shorter than the resource present in the statement we only check parts
                  // that are present in the resource definition. for example,  when the resource definiton is [ '5f30fffd4a51a68d6fec4d3b']
                  // and resource in the statement is ["5f30fffd4a51a68d6fec4d3b", "5f31002e4a51a68d6fec4d3f"]
                  // we only check definition.resource[0] against resource[0] in the statement and the rest will be passed as mongodb aggregation
                  // to filter out in database layer.
                  resourceAndModule.resource.every(
                    (part, index) => part == resource[index] || resource[index] == "*"
                  )
                );
              } else {
                // INCLUDE THIS EXCLUDE THESE
                const resource = statement.resource;
                // We need parse resources that has slash in it to match them individually.
                const includeResource = resource.include[0].split("/");

                const hasExcludedResources = resource.exclude && resource.exclude.length;

                const excluded: string[][] = [];

                if (hasExcludedResources) {
                  for (const excludeResource of resource.exclude) {
                    const excludedResource = excludeResource.split("/");
                    excluded.push(excludedResource);
                  }
                }

                match = resourceAndModule.resource.every((part, index) => {
                  const pattern = [includeResource[index]];

                  // Since the exclude is optional we have check if it is present
                  if (hasExcludedResources) {
                    for (const resource of excluded) {
                      if (hasResourceFilter && getLastSegment(resource) == "*") {
                        // If all subresources excluded in index endpoint
                        pattern.push(`!${resource[index]}`);
                      } else if (
                        !hasResourceFilter &&
                        index == resourceAndModule.resource.length - 1 &&
                        getLastSegment(resource) != "*" // If one subresource excluded in non-index endpoint
                      ) {
                        pattern.push(`!${resource[index]}`);
                      } else if (!hasResourceFilter && getLastSegment(resource) == "*") {
                        // If all subresources excluded in non-index endpoint
                        pattern.push(`!${resource[0]}`);
                      }
                    }
                  }

                  return matcher.isMatch(part, pattern);
                });
              }
            } else if (typeof statement.resource == "undefined") {
              // If matches the definition then it is safe to mark this statement
              //  as the action and the module matches
              match = true;
            }

            // If the current resource has names we have to check them explicitly
            // otherwise we just pass those to controllers to filter out in database layer
            if (match) {
              result = true;
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

function getLastSegment(resource: string[]) {
  return resource[resource.length - 1];
}

function isWildcard(segment: string): segment is "*" {
  return segment == "*";
}
