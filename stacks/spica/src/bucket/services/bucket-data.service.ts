import {HttpClient, HttpHeaders, HttpParams} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult} from "@spica-client/core/interfaces";
import {Observable} from "rxjs";
import {BucketEntry, BucketRow} from "../interfaces/bucket-entry";

interface FindOptions {
  limit?: number;
  skip?: number;
  schedule?: boolean;
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
    {filter, sort, language, limit, skip, schedule}: FindOptions = {}
  ): Observable<IndexResult<BucketEntry>> {
    let params = new HttpParams({fromObject: {paginate: "true"}});
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

    if (schedule) {
      params = params.set("schedule", String(schedule));
    }

    return this.http.get<IndexResult<BucketEntry>>(`api:/bucket/${bucketId}/data`, {
      params,
      headers
    });
  }

  findOne<T = BucketRow>(
    bucketId: string,
    documentId: string,
    prune: boolean = true
  ): Observable<T> {
    let params = new HttpParams();
    if (prune) {
      params = params.set("localize", "false").set("relation", "false");
    }
    return this.http.get<T>(`api:/bucket/${bucketId}/data/${documentId}`, {params: params});
  }

  findOneAndDelete(bucketId: string, id: string): Observable<any> {
    return this.http.delete(`api:/bucket/${bucketId}/data/${id}`);
  }

  deleteMany(bucketId: string, idArray: Array<string>): Observable<any> {
    return this.http.request("delete", `api:/bucket/${bucketId}/data`, {body: idArray});
  }

  replaceOne(bucketId: string, data: any): Observable<any> {
    return this.http.post(`api:/bucket/${bucketId}/data`, data);
  }
}
