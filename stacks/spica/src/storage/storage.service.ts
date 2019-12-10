import {HttpClient, HttpEvent, HttpHeaders, HttpParams, HttpRequest} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult, fileToBuffer} from "@spica-client/core";
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

  updateOne(id: string, file: File): Observable<HttpEvent<Storage>> {
    return from(fileToBuffer(file)).pipe(
      flatMap(content => {
        const data = BSON.serialize({
          _id: id,
          content: {data: new BSON.Binary(content), type: file.type}
        });
        const request = new HttpRequest("PUT", "api:/storage", data.buffer, {
          reportProgress: true,
          headers: new HttpHeaders({"Content-Type": "application/bson"})
        });

        return this.http.request<Storage>(request);
      })
    );
  }

  insertMany(fileList: FileList): Observable<HttpEvent<Storage>> {
    const files = Array.from(fileList);
    return from(Promise.all(files.map(f => fileToBuffer(f)))).pipe(
      flatMap(content => {
        const data = BSON.serialize(
          content.map((c, i) => ({
            name: files[i].name,
            content: {
              data: new BSON.Binary(c),
              type: files[i].type
            }
          }))
        );

        const request = new HttpRequest("POST", "api:/storage", data.buffer, {
          reportProgress: true,
          headers: new HttpHeaders({"Content-Type": "application/bson"})
        });

        return this.http.request<Storage>(request);
      })
    );
  }
}
