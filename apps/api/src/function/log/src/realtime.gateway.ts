import {OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway} from "@nestjs/websockets";
import {RealtimeDatabaseService} from "@spica-server/database/realtime";
import {GuardService} from "@spica-server/passport/guard/services";
import {getConnectionHandlers} from "@spica-server/realtime";
import {LogOptionsBuilder} from "./log-options.builder";

@WebSocketGateway(31, {
  path: "/function-logs"
})
export class LogGateway implements OnGatewayConnection, OnGatewayDisconnect {
  readonly COLLECTION = "function_logs";

  constructor(private realtime: RealtimeDatabaseService, private guardService: GuardService) {}

  private handlers = getConnectionHandlers(
    this.guardService,
    async () => this.COLLECTION,
    this.prepareOptions.bind(this),
    error => ({
      code: error.status || 500,
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

  async prepareOptions(_client, req) {
    return LogOptionsBuilder.fromLogQuery(req);
  }
}
