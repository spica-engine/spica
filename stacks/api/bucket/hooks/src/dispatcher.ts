import {Injectable} from "@nestjs/common";
import {EventEmitter} from "events";
import {ActionOptions} from "./enqueuer";

export function actionKey(bucket: string, type: string) {
  return `${bucket}_${type}`;
}

@Injectable()
export class ActionDispatcher extends EventEmitter {
  dispatch(
    options: ActionOptions,
    headers: Object,
    document?: string
  ): Promise<boolean | unknown[] | object> {
    return new Promise<boolean | unknown[]>((resolve, reject) => {
      const ak = actionKey(options.bucket, options.type);
      if (this.listeners(ak).length) {
        this.emit(ak, resolve, headers, document);
      } else {
        resolve(true);
      }
    });
  }
}
