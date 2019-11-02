import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Omit} from "@spica-client/core";
import * as jwt_decode from "jwt-decode";
import * as matcher from "matcher";
import {Observable} from "rxjs";
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
        this.token = response.token;
        this._statements = undefined;
      })
    );
  }

  identifyWith(strategy: string): Observable<any> {
    return this.http
      .get<any>(`api:/passport/strategy/${strategy}/url`, {
        params: {strategy}
      })
      .pipe(
        concatMap(res => {
          window.open(res.url, "_blank");
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

  checkAllowed(action: string): Observable<boolean> {
    function wrapArray(val: string | string[]) {
      return Array.isArray(val) ? val : Array(val);
    }
    if (!this._statements) {
      // To eliminate redundant requests
      this._statements = this.getStatements().pipe(shareReplay());
    }
    return this._statements.pipe(
      map(statements => {
        const applicableStatements = statements.filter(
          si => matcher(wrapArray(action), wrapArray(si.action)).length > 0
        );

        if (applicableStatements.length < 1) {
          return false;
        }
        const statementResult = applicableStatements.map(s => s.effect === "allow");
        return statementResult.every(sr => sr) ? true : false;
      })
    );
  }
}
