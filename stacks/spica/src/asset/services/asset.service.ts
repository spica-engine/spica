import {HttpClient, HttpParams} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {Asset} from "../interface";

@Injectable()
export class AssetService {
  constructor(private http: HttpClient) {}

  find(packageName?: string): Observable<Asset[]> {
    const params = new HttpParams();

    if (packageName) {
      params.set("metadata.package", packageName);
    }

    return this.http.get<Asset[]>("api:/apis", {
      params
    });
  }
}
