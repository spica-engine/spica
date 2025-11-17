import {OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway} from "@nestjs/websockets";
import {RealtimeDatabaseService} from "@spica-server/database/realtime";
import {GuardService} from "@spica-server/passport/guard/services";
import {getConnectionHandlers} from "@spica-server/realtime";
import {ChunkKind} from "@spica-server/interface/realtime";
import {resourceFilterFunction} from "@spica-server/passport/guard";

@WebSocketGateway({
  path: "/versioncontrol/sync"
})
export class SyncRealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  readonly COLLECTION = "sync";

  constructor(
    private realtime: RealtimeDatabaseService,
    private guardService: GuardService
  ) {}

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
    "versioncontrol:show"
  );

  async handleConnection(client: WebSocket, req: any) {
    return this.handlers.handleConnection(client, req);
  }

  async handleDisconnect(client: any) {
    return this.handlers.handleDisconnect(client, client.upgradeReq);
  }

  async prepareOptions(client, req) {
    const options: any = {filter: {$and: []}};

    const policyMatch = req.resourceFilter || {$match: {}};
    options.filter.$and.push(policyMatch.$match);

    if (req.query.has("filter")) {
      try {
        options.filter.$and.push(JSON.parse(req.query.get("filter")));
      } catch (e) {
        client.send(JSON.stringify({code: 400, message: "Invalid filter JSON: " + e.message}));
        return client.close(1003);
      }
    }

    if (req.query.has("sort")) {
      try {
        options.sort = JSON.parse(req.query.get("sort"));
      } catch (e) {
        client.send(JSON.stringify({code: 400, message: e.message}));
        return client.close(1003);
      }
    }

    if (req.query.has("limit")) {
      options.limit = Number(req.query.get("limit"));
    }

    if (req.query.has("skip")) {
      options.skip = Number(req.query.get("skip"));
    }

    return options;
  }
}
