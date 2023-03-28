import {HttpClient, HttpHeaders, HttpParams} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult} from "@spica-client/core/interfaces";
import {forkJoin, Observable} from "rxjs";
import {map} from "rxjs/operators";
import {BucketEntry, BucketRow} from "../interfaces/bucket-entry";

interface FindOptions {
  limit?: number;
  skip?: number;
  language?: string;
  sort?: {
    [key: string]: number;
  };
  filter?: {
    [key: string]: any;
  };
}

@Injectable()
export class BucketDataService {
  constructor(private http: HttpClient) {}

  find(
    bucketId: string,
    {filter, sort, language, limit, skip}: FindOptions = {}
  ): Observable<IndexResult<BucketEntry>> {
    let params = new HttpParams({fromObject: {paginate: "true", relation: "true"}});
    let headers = new HttpHeaders();

    if (sort) {
      params = params.set("sort", JSON.stringify(sort));
    }

    if (filter) {
      params = params.set("filter", JSON.stringify(filter));
    }

    if (limit) {
      params = params.set("limit", String(limit));
    }

    if (skip) {
      params = params.set("skip", String(skip));
    }

    if (language) {
      headers = headers.set("Accept-Language", language);
    }
    return this.http.get<IndexResult<BucketEntry>>(`api:/bucket/${bucketId}/data`, {
      params,
      headers
    });
  }

  findOne<T = BucketRow>(
    bucketId: string,
    documentId: string,
    localize: boolean = false,
    relation: boolean = false
  ): Observable<T> {
    let params = new HttpParams();

    params = params.set("localize", String(localize)).set("relation", String(relation));
    return this.http.get<T>(`api:/bucket/${bucketId}/data/${documentId}`, {params: params});
  }

  delete(bucketId: string, id: string): Observable<any> {
    return this.http.delete(`api:/bucket/${bucketId}/data/${id}`);
  }

  deleteMany(bucketId: string, idArray: Array<string>): Observable<void> {
    return forkJoin(idArray.map(id => this.delete(bucketId, id))).pipe(map(() => {}));
  }

  insertOne(bucketId: string, data: any): Observable<any> {
    return this.http.post(`api:/bucket/${bucketId}/data`, data);
  }

  replaceOne(bucketId: string, data: any): Observable<any> {
    return this.http.put(`api:/bucket/${bucketId}/data/${data._id}`, data);
  }

  patchOne(bucketId: string, documentId: string, patch: any): Observable<any> {
    return this.http.patch(`api:/bucket/${bucketId}/data/${documentId}`, patch);
  }
}
