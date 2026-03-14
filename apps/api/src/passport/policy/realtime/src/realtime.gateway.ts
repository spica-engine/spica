import {OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway} from "@nestjs/websockets";
import {RealtimeDatabaseService} from "@spica-server/database/realtime";
import {GuardService} from "@spica-server/passport/guard/services";
import {getConnectionHandlers, RealtimeOptionsBuilder} from "@spica-server/realtime";
import {ChunkKind} from "@spica-server/interface/realtime";
import {resourceFilterFunction} from "@spica-server/passport/guard";

@WebSocketGateway({
  path: "/passport/policy"
})
export class PolicyRealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  readonly COLLECTION = "policies";

  constructor(private realtime: RealtimeDatabaseService, private guardService: GuardService) {}

  private handlers = getConnectionHandlers(
    this.guardService,
    async () => this.COLLECTION,
    this.prepareOptions.bind(this),
    error => ({
      kind: ChunkKind.Error,
      status: error.status || 500,
      message: error.message || "Unexpected error"
    }),
    this.realtime,
    resourceFilterFunction,
    "passport:policy:stream"
  );

  async handleConnection(client: WebSocket, req: any) {
    return this.handlers.handleConnection(client, req);
  }

  async handleDisconnect(client: any) {
    return this.handlers.handleDisconnect(client, client.upgradeReq);
  }

  async prepareOptions(_client, req) {
    return RealtimeOptionsBuilder.fromQuery(req, {useResourceFilter: true});
  }
}
