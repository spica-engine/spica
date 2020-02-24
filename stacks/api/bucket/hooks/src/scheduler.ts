import {Injectable} from "@nestjs/common";
import {Subject} from "rxjs";
import {BucketEnqueuerOptions} from "./interface";

@Injectable()
export class Scheduler {
  //private _pushback = new Subject<string>();

  private _stream = new Subject();

  stream = this._stream.asObservable();

  schedule(options: BucketEnqueuerOptions) {
    this._stream.next(options);
    //return this._pushback.toPromise();
  }

  // pushback(data: string): void {
  //   this._pushback.next(data);
  // }
}
