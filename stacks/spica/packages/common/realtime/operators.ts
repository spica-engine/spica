import {Sequence, SequenceKind, ChunkKind} from "./interface";
import {
  tap,
  delayWhen,
  map,
  debounceTime,
  retryWhen,
  filter,
  take,
  mapTo,
  catchError
} from "rxjs/operators";
import {webSocket} from "rxjs/webSocket";
import {timer, of, Observable} from "rxjs";

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

export function getWsObs<T>(url: string, sort: object = {}) {
  const data = new IterableSet<T>();
  return webSocket<any>(url).pipe(
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
      }
    }),
    delayWhen(chunk => {
      if (sort && chunk.kind == ChunkKind.Insert) {
        return timer(2);
      }
      return of(null);
    }),
    debounceTime(1),
    map(() => Array.from(data)),
    retryWhen(errors => errors.pipe(filter(error => error.code == 1006)))
  );
}

export function checkConnectivity(url: string): Observable<boolean> {
  return webSocket(url).pipe(
    take(1),
    catchError(e => {
      return of({error: e} as any);
    }),
    map(r => {
      if (r.error) {
        return false;
      }
      return true;
    })
  );
}
