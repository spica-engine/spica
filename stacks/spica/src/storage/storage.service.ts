import {HttpClient, HttpEvent, HttpHeaders, HttpParams, HttpRequest} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult, fileToBuffer} from "@spica-client/core";
import * as BSON from "bson";
import {Buffer} from "buffer";
import {from, Observable} from "rxjs";
import {flatMap, map} from "rxjs/operators";
import {LastUpdateCache} from "./cache";

import {Storage} from "./interfaces/storage";

window["Buffer"] = Buffer;

@Injectable({providedIn: "root"})
export class StorageService {
  private lastUpdates: LastUpdateCache;
  constructor(private http: HttpClient) {
    this.lastUpdates = new LastUpdateCache();
  }

  getAll<P extends boolean = false>(
    filter?:object,
    limit?: number,
    skip?: number,
    sort?,
    paginate?: P
  ): Observable<P extends true ? IndexResult<Storage> : Storage[]>;
  getAll(
    filter?:object,
    limit?: number,
    skip?: number,
    sort?,
    paginate = false
  ): Observable<Storage[] | IndexResult<Storage>> {
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

    if(filter){
      params = params.append("filter", JSON.stringify(filter));
    }

    // we will change this later on
    params = params.append("paginate", JSON.stringify(paginate));

    return this.http.get<Storage[] | IndexResult<Storage>>("api:/storage", {params}).pipe(
      map(objects => {
        for (let object of Array.isArray(objects) ? objects : objects.data) {
          object = this.prepareToDisplay(object);
        }
        return objects;
      })
    );
  }

  getOne(id: string): Observable<Storage> {
    return this.http
      .get<Storage>(`api:/storage/${id}`)
      .pipe(map(object => this.prepareToDisplay(object)));
  }

  delete(id: string): Observable<void> {
    this.lastUpdates.unregister(id);
    return this.http.delete<void>(`api:/storage/${id}`);
  }

  updateOne(storageObject: Storage, file: File): Observable<HttpEvent<Storage>> {
    storageObject = this.prepareToUpdate(storageObject);

    return from(fileToBuffer(file)).pipe(
      flatMap(content => {
        const schema = {
          ...storageObject,
          content: {data: new BSON.Binary(content), type: file.type}
        };

        const id = schema._id;
        delete schema._id;

        delete schema.url;

        const data = BSON.serialize(schema, {
          minInternalBufferSize: BSON.calculateObjectSize(schema)
        } as any);
        const request = new HttpRequest("PUT", `api:/storage/${id}`, data.buffer, {
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
        const contents = {
          content: content.map((c, i) => ({
            name: files[i].name,
            content: {
              data: new BSON.Binary(c),
              type: files[i].type
            }
          }))
        };
        const size = BSON.calculateObjectSize(contents);
        const buffer = BSON.serialize(contents, {minInternalBufferSize: size} as any);
        const request = new HttpRequest("POST", "api:/storage", buffer.buffer, {
          reportProgress: true,
          headers: new HttpHeaders({"Content-Type": "application/bson"})
        });
        return this.http.request<Storage>(request);
      })
    );
  }

  private prepareToDisplay(object: Storage) {
    const lastUpdate = this.lastUpdates.register(object._id);

    object.url = this.putTimestamp(object.url, lastUpdate);

    return object;
  }

  private prepareToUpdate(object: Storage) {
    // UI will be affected from this url timestamp changes if we remove this.
    object = this.deepCopy(object);

    this.lastUpdates.unregister(object._id);

    object.url = this.clearTimestamp(object.url);

    return object;
  }

  putTimestamp(url: string, value: string) {
    const updatedUrl = new URL(url);
    updatedUrl.searchParams.append("timestamp", value);
    return updatedUrl.toString();
  }

  clearTimestamp(url: string) {
    const updatedUrl = new URL(url);
    updatedUrl.searchParams.delete("timestamp");
    return updatedUrl.toString();
  }

  private deepCopy(value: unknown) {
    return JSON.parse(JSON.stringify(value));
  }
}
