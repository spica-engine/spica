import {Sequence, SequenceKind, ChunkKind, OperationKind} from "@spica-devkit/bucket";
//@ts-ignore
import WebSocket from "ws";
import {tap, delayWhen, map, debounceTime, retryWhen, filter} from "rxjs/operators";
import {webSocket, WebSocketSubject, WebSocketSubjectConfig} from "rxjs/webSocket";
import {timer, of, Observable, OperatorFunction} from "rxjs";
import {isPlatformBrowser} from "@spica-devkit/internal_common";

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
  findOne?: boolean
): Observable<T[]> & {
  /**
   * INSERT
   * REPLACE
   * PATCH
   * DELETE
   */
  next: (kind: OperationKind, document: any) => void;
} {
  let data = new IterableSet<T>();

  let urlConfigOrSource: string | WebSocketSubjectConfig<any> = url;

  if (!isPlatformBrowser()) {
    urlConfigOrSource = {
      url: url,
      WebSocketCtor: WebSocket
    };
  }

  const subject = webSocket<any>(urlConfigOrSource);

  const next = (kind: OperationKind, document: any) => subject.next({event: kind, data: document});

  const observable = subject.pipe(
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
    map(() => (findOne ? Array.from(data)[0] : Array.from(data)))
  );

  observable["next"] = next;

  return observable as any;
}
