import {HttpClient} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {BucketEntry} from "./interfaces/bucket-entry";
import {BucketHistory} from "./interfaces/bucket-history";

@Injectable()
export class BucketHistoryService {
  constructor(private http: HttpClient) {}

  historyList(bucketId, bucketDataId): Observable<Array<BucketHistory>> {
    return this.http.get<Array<BucketHistory>>(`api:/bucket/${bucketId}/history/${bucketDataId}`);
  }

  revertTo(bucketId: string, bucketDataId: string, historyId: string) {
    return this.http.post<BucketEntry>(
      `api:/bucket/${bucketId}/history/${bucketDataId}/${historyId}`,
      {}
    );
  }
}
