import {OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway} from "@nestjs/websockets";
import {RealtimeDatabaseService} from "@spica-server/database/realtime";
import {GuardService} from "@spica-server/passport";
import {getConnectionHandlers} from "@spica-server/realtime";

@WebSocketGateway({
  path: "/dashboard"
})
export class RealtimeDashboardService implements OnGatewayConnection, OnGatewayDisconnect {
  readonly COLLECTION = "dashboard";

  constructor(
    private realtime: RealtimeDatabaseService,
    private guardService: GuardService
  ) {}

  private handlers = getConnectionHandlers(
    this.guardService,
    async () => this.COLLECTION,
    async () => ({}),
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
}
