import {ChunkKind, Sequence, SequenceKind} from "@spica/interface";
import {RealtimeConnection, RealtimeConnectionOne} from "./interface";
import {tap, delayWhen, map, debounceTime, retryWhen, filter, takeWhile} from "rxjs/operators";
import {webSocket, WebSocketSubjectConfig} from "rxjs/webSocket";
import {timer, of, Observable} from "rxjs";
import {isPlatformBrowser} from "../../internal_common";

export class IterableSet<T> implements Iterable<T> {
  ids = new Array<string>();
  dataset = new Map<string, T>();
  order(sequences: Sequence[]) {
    if (sequences) {
      const deletedIds = new Set<string>();
      for (const sequence of sequences) {
        switch (sequence.kind) {
          case SequenceKind.Substitute:
            this.ids[sequence.at] = sequence.with;
            break;
          case SequenceKind.Insert:
            this.ids.splice(sequence.at, 0, sequence.item);
            break;
          case SequenceKind.Delete:
            this.ids.splice(sequence.at, 1);
            deletedIds.add(sequence.item);
            break;
        }
      }
      // TODO: This should be handled at backend.
      deletedIds.forEach(id => {
        if (this.ids.indexOf(id) == -1) {
          this.dataset.delete(id);
        }
      });
    }
  }
  set(id: string, value: any) {
    if (!this.dataset.has(id)) {
      this.ids.push(id);
    }
    this.dataset.set(id, value);
  }
  delete(id: string, index?: number) {
    index = index || this.ids.indexOf(id);
    this.dataset.delete(id);
    this.ids.splice(index, 1);
  }
  [Symbol.iterator]() {
    let i = 0;
    return {
      next: () => {
        let value: T;
        if (i < this.ids.length) {
          value = this.dataset.get(this.ids[i]);
        }
        return {
          value: value,
          done: (i += 1) > this.ids.length
        };
      }
    } as Iterator<T>;
  }
}

export function getWsObs<T>(
  url: string,
  sort?: object,
  targetDocumentId?: string,
  messageCallback?: (res: {status: number; message: string}) => any
): RealtimeConnectionOne<T>;
export function getWsObs<T>(
  url: string,
  sort?: object,
  targetDocumentId?: null,
  messageCallback?: (res: {status: number; message: string}) => any
): RealtimeConnection<T[]>;
export function getWsObs<T>(
  url: string,
  sort?: object,
  targetDocumentId?: string | null,
  messageCallback: (res: {status: number; message: string}) => any = res => {
    if (res.status >= 400 && res.status < 600) {
      return console.error(res.message);
    }
  }
): RealtimeConnectionOne<T> | RealtimeConnection<T[]> {
  let data = new IterableSet<T>();

  let urlConfigOrSource: string | WebSocketSubjectConfig<any> = url;

  if (!isPlatformBrowser()) {
    const wsCtor = require("ws");
    urlConfigOrSource = {
      url: url,
      WebSocketCtor: wsCtor
    };
  }

  const subject = webSocket<any>(urlConfigOrSource);

  const observable = subject.pipe(
    tap(chunk => {
      if (chunk.kind == ChunkKind.Response) {
        messageCallback({status: chunk.status, message: chunk.message});
      }
    }),
    filter(chunk => chunk.kind != ChunkKind.Response),
    retryWhen(errors => errors.pipe(filter(error => error.code == 1006))),
    tap(chunk => {
      switch (chunk.kind) {
        case ChunkKind.Initial:
        case ChunkKind.Insert:
        case ChunkKind.Replace:
        case ChunkKind.Update:
          data.set(chunk.document._id, chunk.document);
          break;
        case ChunkKind.Expunge:
        case ChunkKind.Delete:
          data.delete(chunk.document._id);
          break;
        case ChunkKind.Order:
          data.order(chunk.sequence);
          break;
        case ChunkKind.Error:
          delete chunk.kind;
          throw new Error(JSON.stringify(chunk));
      }
    }),
    delayWhen(chunk => {
      if (sort && chunk.kind == ChunkKind.Insert) {
        return timer(2);
      }
      return of(null);
    }),
    debounceTime(1),
    map(() => (targetDocumentId ? Array.from(data)[0] : Array.from(data)))
  );

  const insert = document => subject.next({event: "insert", data: document});
  observable["insert"] = insert;

  const replace = document => subject.next({event: "replace", data: document});
  const replaceTargetDocument = document => {
    document._id = targetDocumentId;
    subject.next({event: "replace", data: document});
  };
  observable["replace"] = targetDocumentId ? replaceTargetDocument : replace;

  const patch = document => subject.next({event: "patch", data: document});
  const patchTargetDocument = document => {
    document._id = targetDocumentId;
    subject.next({event: "patch", data: document});
  };
  observable["patch"] = targetDocumentId ? patchTargetDocument : patch;

  const remove = document => subject.next({event: "delete", data: document});
  const removeTargetDocument = () => subject.next({event: "delete", data: {_id: targetDocumentId}});

  observable["remove"] = targetDocumentId ? removeTargetDocument : remove;

  return observable as any;
}
