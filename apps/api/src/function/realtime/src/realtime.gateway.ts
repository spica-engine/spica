import {OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway} from "@nestjs/websockets";
import {RealtimeDatabaseService} from "../../../../../../libs/database/realtime";
import {GuardService} from "../../../passport";
import {getConnectionHandlers} from "../../../../../../libs/realtime";
import {ChunkKind} from "../../../../../../libs/interface/realtime";

@WebSocketGateway({
  path: "/function"
})
export class RealtimeFunctionService implements OnGatewayConnection, OnGatewayDisconnect {
  readonly COLLECTION = "function";

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
    this.realtime
  );

  async handleConnection(client: WebSocket, req: any) {
    return this.handlers.handleConnection(client, req);
  }

  async handleDisconnect(client: any) {
    return this.handlers.handleDisconnect(client, client.upgradeReq);
  }

  async prepareOptions(client, req) {
    const options: any = {};

    if (req.query.has("filter")) {
      try {
        options.filter = JSON.parse(req.query.get("filter"));
      } catch (e) {
        client.send(JSON.stringify({code: 400, message: "Invalid filter JSON: " + e.message}));
        return client.close(1003);
      }
    }

    return options;
  }
}
