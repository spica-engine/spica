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
      map(statements =>
        statements
          .filter(st => action.substring(0, action.lastIndexOf(":")) == st.service)
          .filter(
            st =>
              wrapArray(st.action).includes(st.service + ":*") ||
              wrapArray(st.action).includes(action)
          )
          .map(st => {
            st.resource = wrapArray(st.resource).map(res => res.replace(st.service + "/", ""));
            return st;
          })
      ),
      map(statements => {
        if (
          (action.includes("create") ||
            (action.includes("policy") && !action.endsWith("policy"))) &&
          statements.length > 0
        ) {
          return createLastDecision(statements);
        }

        let state = createLastState(statements);

        if (!state.alloweds.length) {
          return false;
        } else {
          if (action.includes("index")) {
            return true;
          } else {
            return (
              (state.alloweds.includes("*") && !state.denieds.includes(resource)) ||
              state.alloweds.includes(resource)
            );
          }
        }
      })
    );
  }
}

export function createLastDecision(statements: Statement[]): boolean {
  return statements[statements.length - 1].effect == "allow";
}

export function wrapArray(val: string | string[]) {
  return Array.isArray(val) ? val : Array(val);
}

export function createLastState(statements: Statement[]) {
  return statements.reduce(
    (acc, curr) => {
      let state = acc;

      if (wrapArray(curr.resource).includes("*")) {
        if (curr.effect == "allow") {
          state.alloweds = ["*"];
          state.denieds = [];
        } else {
          state.denieds = ["*"];
          state.alloweds = [];
        }
      } else {
        wrapArray(curr.resource).forEach(res => {
          if (curr.effect == "allow") {
            state.denieds = state.denieds.filter(rs => rs != res);
            if (!state.alloweds.includes("*")) {
              state.alloweds.push(res);
            }
          } else {
            state.alloweds = state.alloweds.filter(rs => rs != res);
            if (!state.denieds.includes("*")) {
              state.denieds.push(res);
            }
          }
        });
      }
      return state;
    },
    {alloweds: [], denieds: []}
  );
}
