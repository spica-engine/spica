import {HttpClient, HttpEvent, HttpHeaders, HttpParams, HttpRequest} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult, fileToBuffer} from "@spica-client/core";
import * as BSON from "bson";
import {Buffer} from "buffer";
import {from, Observable} from "rxjs";
import {flatMap, map} from "rxjs/operators";
import {LastUpdateCache} from "../cache";
import {Filters} from "../helpers";

import {Storage} from "../interfaces/storage";

window["Buffer"] = Buffer;

@Injectable({providedIn: "root"})
export class StorageService {
  private lastUpdates: LastUpdateCache;
  constructor(private http: HttpClient) {
    this.lastUpdates = new LastUpdateCache();
  }

  getAll<P extends boolean = false>(options?: {
    filter?: object;
    limit?: number;
    skip?: number;
    sort?;
    paginate?: P;
  }): Observable<P extends true ? IndexResult<Storage> : Storage[]>;
  getAll(
    options: {
      filter?: object;
      limit?: number;
      skip?: number;
      sort?: object;
      paginate?: boolean;
    } = {}
  ): Observable<Storage[] | IndexResult<Storage>> {
    let params = new HttpParams();

    const {limit, skip, sort, filter, paginate} = options;

    if (limit) {
      params = params.append("limit", limit.toString());
    }
    if (skip) {
      params = params.append("skip", skip.toString());
    }
    if (sort) {
      params = params.append("sort", JSON.stringify(sort));
    }

    if (filter) {
      params = params.append("filter", JSON.stringify(filter));
    }

    params = params.append("paginate", JSON.stringify(paginate || false));

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

    const formData = new FormData();
    formData.append("file", this.updateFileName(file, storageObject.name));

    const request = new HttpRequest("PUT", `api:/storage/${storageObject._id}`, formData, {
      reportProgress: true
    });

    return this.http.request<Storage>(request);
  }

  private prepareFile(file: File, prefix?: string) {
    let name = prefix ? `${prefix}${file.name}` : file.name;
    return this.updateFileName(file, name);
  }

  private updateFileName(file: File, name: string) {
    name = encodeURIComponent(name);
    return new File([file], name, {type: file.type, lastModified: file.lastModified});
  }

  insertMany(fileList: FileList, prefix?: string): Observable<HttpEvent<Storage>> {
    const files = Array.from(fileList).map(file => {
      return this.prepareFile(file, prefix);
    });

    const formData = new FormData();

    files.forEach(file => formData.append("files", file));

    const request = new HttpRequest("POST", "api:/storage", formData, {
      reportProgress: true
    });

    return this.http.request<Storage>(request);
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

  urlToId(url: string) {
    const id = url.match(/\/o\/(.*?)\?/)?.[1];
    const isValidId = /^[a-fA-F0-9]{24}$/.test(id);
    if(isValidId){
      return id;
    }
    return url;
  }

  private deepCopy(value: unknown) {
    return JSON.parse(JSON.stringify(value));
  }

  listSubResources(name: string, itself: boolean) {
    return this.getAll({filter: Filters.ListAllChildren(name, itself)}).toPromise();
  }

  updateName(_id: string, name: string) {
    return this.http.patch(`api:/storage/${_id}`, {name});
  }
}
