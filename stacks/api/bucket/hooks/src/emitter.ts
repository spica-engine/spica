import {Injectable} from "@nestjs/common";
import {EventEmitter} from "events";

export function changeKey(bucket: string, type: string) {
  return `${bucket}_${type.toLowerCase()}`;
}

@Injectable()
export class ChangeEmitter extends EventEmitter {
  emitChange(
    options: {bucket: string; type: string},
    documentKey: string,
    previous?: Object,
    current?: Object
  ): void {
    this.emit(
      changeKey(options.bucket, options.type),
      options.type,
      documentKey,
      previous,
      current
    );
    this.emit(changeKey(options.bucket, "all"), options.type, documentKey, previous, current);
  }
}
