import {HttpClient, HttpHeaders, HttpRequest} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {select, Store} from "@ngrx/store";
import {fileToBuffer, PreferencesService} from "@spica-client/core";
import * as BSON from "bson";
import {from, Observable, pipe} from "rxjs";
import {filter, flatMap, map, tap, debounceTime} from "rxjs/operators";
import {Storage} from "../../storage/interfaces/storage";
import {Bucket, BucketTemplate} from "../interfaces/bucket";
import {BucketSettings} from "../interfaces/bucket-settings";
import {PredefinedDefault} from "../interfaces/predefined-default";
import * as fromBucket from "../state/bucket.reducer";

@Injectable()
export class BucketService {
  constructor(
    private http: HttpClient,
    private store: Store<fromBucket.State>,
    private preference: PreferencesService
  ) {}

  getPreferences() {
    return this.preference.get<BucketSettings>("bucket");
  }

  retrieve() {
    return this.http
      .get<Bucket[]>(`api:/bucket`)
      .pipe(tap(buckets => this.store.dispatch(new fromBucket.Retrieve(buckets))));
  }

  getBuckets(): Observable<Bucket[]> {
    return this.store.pipe(select(fromBucket.selectAll));
  }

  getBucket(bucketId: string): Observable<Bucket> {
    return this.store.select(fromBucket.selectEntities).pipe(
      filter(entities => !!entities[bucketId]),
      map(entities => entities[bucketId])
    );
  }

  delete(id: string): Observable<any> {
    return this.http
      .delete(`api:/bucket/${id}`)
      .pipe(tap(() => this.store.dispatch(new fromBucket.Remove(id))));
  }

  insertOne(bucket: Bucket): Observable<Bucket> {
    return this.http
      .post<Bucket>(`api:/bucket`, bucket)
      .pipe(tap(bucket => this.store.dispatch(new fromBucket.Upsert(bucket))));
  }

  replaceOne(bucket: Bucket): Observable<Bucket> {
    return this.http
      .put<Bucket>(`api:/bucket/${bucket._id}`, bucket)
      .pipe(tap(bucket => this.store.dispatch(new fromBucket.Replace(bucket))));
  }

  sendPatchRequest(id: string, changes: object): Observable<Bucket> {
    return this.http.patch<Bucket>(`api:/bucket/${id}`, changes, {
      headers: new HttpHeaders().set("Content-Type", "application/merge-patch+json")
    });
  }

  patchBucket(id: string, changes: object): Observable<Bucket> {
    return this.sendPatchRequest(id, changes).pipe(
      tap(_ => this.store.dispatch(new fromBucket.Update(id, changes)))
    );
  }

  patchBucketMany(changes: {id: string; changes: object}[]): Promise<Bucket[]> {
    return Promise.all(
      changes.map(change => this.sendPatchRequest(change.id, change.changes).toPromise())
    ).then((res: Bucket[]) => {
      //If field come with undefined value, Upsert will remove that field. But Upsert must know which value has undefined.
      this.store.dispatch(
        new fromBucket.UpsertMany(
          res.map(bucketItem => {
            return {...bucketItem, ...changes.find(change => change.id == bucketItem._id).changes};
          })
        )
      );

      return Promise.resolve(res);
    });
  }

  getPredefinedDefaults(): Observable<PredefinedDefault[]> {
    return this.http.get<PredefinedDefault[]>(`api:/bucket/predefineddefaults`);
  }

  importData(file: File, bucketId: string): Observable<any> {
    return from(fileToBuffer(file)).pipe(
      flatMap(content => {
        const data = BSON.serialize({
          content: {
            data: new BSON.Binary(content),
            type: file.type
          }
        });
        const request = new HttpRequest("POST", `api:/bucket/import/${bucketId}`, data.buffer, {
          reportProgress: true,
          headers: new HttpHeaders({"Content-Type": "application/bson"})
        });

        return this.http.request<Storage>(request);
      })
    );
  }

  importSchema(file: File): Observable<any> {
    return from(fileToBuffer(file)).pipe(
      flatMap(content => {
        const data = BSON.serialize({
          content: {
            data: new BSON.Binary(content),
            type: file.type
          }
        });
        const request = new HttpRequest("POST", `api:/bucket/import-schema`, data.buffer, {
          reportProgress: true,
          headers: new HttpHeaders({"Content-Type": "application/bson"})
        });

        return this.http.request<Storage>(request);
      })
    );
  }

  exportData(bucketIds: Array<string>): Observable<any> {
    return this.http.post(`api:/bucket/export`, bucketIds, {responseType: "blob"});
  }

  exportSchema(bucketIds: Array<string>): Observable<any> {
    return this.http.post(`api:/bucket/export-schema`, bucketIds, {responseType: "blob"});
  }

  getTemplates(): Observable<any> {
    return this.http.get<any>(`api:/bucket/templates`);
  }

  createFromTemplate(template: BucketTemplate): Observable<any> {
    return this.http.post(`api:/bucket/templates`, template);
  }

  guideRequest(request: string, headers?: object): Observable<any> {
    return this.http.get(`api:${request}`, headers);
  }
}
