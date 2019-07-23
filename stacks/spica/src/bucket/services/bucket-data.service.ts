import {HttpClient, HttpHeaders, HttpParams} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {IndexResult} from "@spica-client/core/interfaces";
import {Observable} from "rxjs";
import {BucketAggregations} from "../interfaces/bucket-aggregations";
import {BucketEntry, BucketRow} from "../interfaces/bucket-entry";

interface FindOptions {
  limit?: number;
  skip?: number;
  aggregations?: BucketAggregations;
  language?: string;
}

@Injectable()
export class BucketDataService {
  constructor(private http: HttpClient) {}

  find(
    bucketId: string,
    {aggregations, language, limit, skip}: FindOptions = {}
  ): Observable<IndexResult<BucketEntry>> {
    let params = new HttpParams();
    let headers = new HttpHeaders();
    if (aggregations) {
      const filter = [];
      if (aggregations.filter) {
        filter.push({$match: JSON.parse(aggregations.filter)});
      }

      if (aggregations.sort.active && aggregations.sort.direction) {
        filter.push({$sort: {[aggregations.sort.active]: aggregations.sort.direction}});
      }

      if (filter.length) {
        params = params.set("filter", JSON.stringify(filter));
      }
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

  findOne<T = BucketRow>(bucketId: string, id: string, prune: boolean = true): Observable<T> {
    let params = new HttpParams();
    if (prune) {
      params = params.set("prune", String(prune));
    }
    return this.http.get<T>(`api:/bucket/${bucketId}/data/${id}`, {params: params});
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
