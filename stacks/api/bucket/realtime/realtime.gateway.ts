import {SubscribeMessage, WebSocketGateway, WsResponse} from "@nestjs/websockets";
import {ObjectId} from "@spica-server/database";
import {RealtimeDatabaseService, StreamChunk} from "@spica-server/database/realtime";
import {Observable, Subject} from "rxjs";
import {filter, map, takeUntil, tap} from "rxjs/operators";

/** @internal */
@WebSocketGateway({
  namespace: "bucket",
  transports: ["websocket"]
})
export class RealtimeGateway {
  streams = new Map<string, Observable<StreamChunk<any>>>();

  constructor(private realtime: RealtimeDatabaseService) {}

  private dispose = new Subject<string>();

  @SubscribeMessage("find")
  find(_, [bucketId, options]): Observable<WsResponse> {
    const cursorName = `find_${bucketId}_${JSON.stringify(options)}`;
    let stream = this.streams.get(cursorName);
    if (!stream) {
      stream = this.realtime
        .find(getBucketDataCollection(bucketId), options)
        .pipe(tap({complete: () => this.streams.delete(cursorName)}));
      this.streams.set(cursorName, stream);
    }
    return stream.pipe(
      takeUntil(this.dispose.pipe(filter(e => e == cursorName))),
      map(data => ({event: cursorName, data}))
    );
  }

  @SubscribeMessage("close")
  close(_, cursorName: string) {
    this.dispose.next(cursorName);
  }
}

export function getBucketDataCollection(bucketId: string | ObjectId): string {
  return `bucket_${bucketId}`;
}
