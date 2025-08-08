import {OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway} from "@nestjs/websockets";
import {RealtimeDatabaseService} from "../../../../../../../libs/database/realtime";
import {GuardService} from "../../../services";
import {getConnectionHandlers} from "../../../../../../../libs/realtime";
import {ChunkKind} from "../../../../../../../libs/interface/realtime";
import {resourceFilterFunction} from "../../../guard";

@WebSocketGateway({
  path: "/passport/identity"
})
export class IdentityRealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  readonly COLLECTION = "identity";

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
    "passport:identity:stream"
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
      const parsedFilter = JSON.parse(req.query.get("filter"));
      options.filter.$and.push(parsedFilter);
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
