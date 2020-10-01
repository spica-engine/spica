import {Injectable} from "@nestjs/common";
import {EventEmitter} from "events";

export function reviewKey(bucket: string, type: string) {
  return `${bucket}_${type.toLowerCase()}`;
}

@Injectable()
export class ReviewDispatcher extends EventEmitter {
  dispatch(
    options: {bucket: string; type: string},
    headers: Object,
    document?: string
  ): Promise<boolean | unknown[] | object> {
    return new Promise<boolean | unknown[]>(resolve => {
      const rk = reviewKey(options.bucket, options.type);
      if (this.listeners(rk).length) {
        this.emit(rk, resolve, headers, document);
      } else {
        resolve(true);
      }
    });
  }
}
