import {Injectable} from "@nestjs/common";
import {EventEmitter} from "events";

export function actionKey(bucket: string, type: string) {
  return `${bucket}_${type}`;
}

@Injectable()
export class ActionDispatcher extends EventEmitter {
  dispatch(bucket: string, type: string, headers: Object): Promise<boolean | unknown[]> {
    return new Promise<boolean | unknown[]>((resolve, reject) => {
      const ak = actionKey(bucket, type);
      if (this.listeners(ak).length) {
        this.emit(ak, resolve, headers, bucket);
      } else {
        resolve();
      }
    });
  }
}
