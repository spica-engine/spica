import {SubscribeMessage, WebSocketGateway} from "@nestjs/websockets";
import {ObjectId} from "@spica-server/database";
import {RealtimeDatabaseService} from "@spica-server/database/realtime";
import {map} from "rxjs/operators";

@WebSocketGateway({
  namespace: "bucket",
  transports: ["websocket"]
})
export class RealtimeGateway {
  constructor(private realtime: RealtimeDatabaseService) {}

  @SubscribeMessage("find")
  find(_, [bucketId, filter]) {
    return this.realtime
      .find(getBucketDataCollection(bucketId), filter)
      .pipe(map(data => ({event: "find", data})));
  }
}

export function getBucketDataCollection(bucketId: string | ObjectId): string {
  return `bucket_${bucketId}`;
}
