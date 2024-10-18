import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";

@Injectable()
export class PreferencesService {
  constructor(private http: HttpClient) {}

  get<T extends PreferencesMeta>(scope: string, ddefault?: T): Observable<T> {
    return this.http
      .get<T>(`api:/preference/${scope}`)
      .pipe(map(resp => (!resp && ddefault ? ddefault : resp)));
  }

  replaceOne(setting: PreferencesMeta): Observable<void> {
    return this.http.put<void>(`api:/preference/${setting.scope}`, setting);
  }

  insertOne(setting: PreferencesMeta): Observable<void> {
    return this.http.post<void>("api:/preference", setting);
  }
}

export interface PreferencesMeta {
  _id?: string;
  scope: string;
  [key: string]: any;
}
