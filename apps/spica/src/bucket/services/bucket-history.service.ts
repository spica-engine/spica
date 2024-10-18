import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {BucketEntry} from "../interfaces/bucket-entry";
import {BucketHistory} from "../interfaces/bucket-history";

@Injectable()
export class BucketHistoryService {
  constructor(private http: HttpClient) {}

  historyList(bucketId: string, rowId: string): Observable<Array<BucketHistory>> {
    return this.http.get<Array<BucketHistory>>(`api:/bucket/${bucketId}/history/${rowId}`);
  }

  revertTo(bucketId: string, bucketDataId: string, historyId: string) {
    return this.http.get<BucketEntry>(
      `api:/bucket/${bucketId}/history/${bucketDataId}/${historyId}`
    );
  }

  clearHistories(bucketId: string) {
    return this.http.delete(`api:/bucket/${bucketId}/history`);
  }
}
