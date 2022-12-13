import {HttpClient, HttpParams} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Store} from "@ngrx/store";
import {of} from "rxjs";
import {filter, switchMap, tap} from "rxjs/operators";
import {Asset, Configuration, CurrentResources, ExportMeta, InstallationPreview, Status} from "../interfaces";
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

  install(id: string, configs: Configuration[], preview: boolean) {
    return this.http
      .post<any>(`api:/asset/${id}`, {configs}, {params: {preview: preview.toString()}})
      .pipe(
        tap(updatedAsset => !preview && this.store.dispatch(new fromAsset.Update(id, updatedAsset)))
      );
  }

  remove(id: string, type: "hard" | "soft" = "soft") {
    return this.http.delete(`api:/asset/${id}`, {params: {type}}).pipe(
      switchMap(() => {
        if (type == "soft") {
          return this.http
            .get(`api:/asset/${id}`)
            .pipe(tap(asset => this.store.dispatch(new fromAsset.Update(id, asset))));
        } else {
          return of(this.store.dispatch(new fromAsset.Remove(id)));
        }
      })
    );
  }

  export(meta: ExportMeta) {
    return this.http.post("api:/asset/export", meta, {responseType: "blob"});
  }

  listResources() {
    return this.http.get<CurrentResources>("api:/asset/resource");
  }

  retrieve() {
    return this.http
      .get<Asset[]>("api:/asset")
      .pipe(tap(assets => this.store.dispatch(new fromAsset.Retrieve(assets))));
  }
}
