import {HttpClient, HttpParams} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Store} from "@ngrx/store";
import {of} from "rxjs";
import {switchMap, tap} from "rxjs/operators";
import {Asset, Configuration, Status} from "../interfaces";
import * as fromAsset from "../state/asset.reducer";

@Injectable()
export class AssetService {
  constructor(private http: HttpClient, private store: Store<fromAsset.State>) {}

  find() {
    return this.store.select(fromAsset.selectAll);
  }

  findById(id: string) {
    return this.store.select(fromAsset.selectEntity(id));
  }

  install(id: string, configs: Configuration[], preview = false) {
    return this.http
      .post(`api:/asset/${id}`, {configs}, {params: {preview: preview.toString()}})
      .pipe(tap(updatedAsset => this.store.dispatch(new fromAsset.Update(id, updatedAsset))));
  }

  remove(id: string, type: "hard" | "soft" = "soft") {
    return this.http.delete(`api:/asset/${id}`, {params: {type}}).pipe(
      switchMap(() => {
        if (type == "soft") {
          return this.http
            .get(`api:/asset/${id}`)
            .pipe(tap(asset => this.store.dispatch(new fromAsset.Update(id, asset))));
        } else {
          return of().pipe(tap(() => this.store.dispatch(new fromAsset.Remove(id))));
        }
      })
    );
  }

  retrieve() {
    return this.http
      .get<Asset[]>("api:/asset")
      .pipe(tap(assets => this.store.dispatch(new fromAsset.Retrieve(assets))));
  }
}
