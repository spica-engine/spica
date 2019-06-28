import {HttpClient, HttpEvent, HttpHeaders, HttpParams, HttpRequest} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult} from "@spica-client/core/interfaces";
import * as BSON from "bson";
import {Buffer} from "buffer";
import {from, Observable} from "rxjs";
import {flatMap} from "rxjs/operators";

import {Storage} from "./interfaces/storage";

window["Buffer"] = Buffer;

@Injectable({providedIn: "root"})
export class StorageService {
  constructor(private http: HttpClient) {}

  getAll(limit?: number, skip?: number, sort?): Observable<IndexResult<Storage>> {
    let params = new HttpParams();
    if (limit) {
      params = params.append("limit", limit.toString());
    }
    if (skip) {
      params = params.append("skip", skip.toString());
    }
    if (sort) {
      params = params.append("sort", JSON.stringify(sort));
    }
    return this.http.get<IndexResult<Storage>>("api:/storage", {params});
  }

  getOne(id, withMeta = "true"): Observable<Storage> {
    return this.http.get<Storage>(`api:/storage/${id}`, {params: {withMeta: withMeta}});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`api:/storage/${id}`);
  }

  upsertOne(storage: Storage, file: File): Observable<HttpEvent<Storage>> {
    return from(fileToBuffer(file)).pipe(
      flatMap(content => {
        const data = BSON.serialize({
          ...storage,
          content: {data: new BSON.Binary(content), type: file.type}
        });
        const request = new HttpRequest("POST", "api:/storage", data.buffer, {
          reportProgress: true,
          headers: new HttpHeaders({"Content-Type": "application/bson"})
        });

        return this.http.request<Storage>(request);
      })
    );
  }
}

function fileToBuffer(file: File): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => resolve(new Buffer(reader.result as ArrayBuffer));
    reader.onerror = error => reject(error);
  });
}
