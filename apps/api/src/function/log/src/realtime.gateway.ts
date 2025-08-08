import {OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway} from "@nestjs/websockets";
import {RealtimeDatabaseService} from "../../../../../../libs/database/realtime";
import {GuardService} from "../../../passport";
import {getConnectionHandlers} from "../../../../../../libs/realtime";

@WebSocketGateway(31, {
  path: "/function-logs"
})
export class LogGateway implements OnGatewayConnection, OnGatewayDisconnect {
  readonly COLLECTION = "function_logs";

  constructor(
    private realtime: RealtimeDatabaseService,
    private guardService: GuardService
  ) {}

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

  async prepareOptions(client, req) {
    const options: any = {};

    if (req.query.has("functions")) {
      options.filter = {
        function: {
          $in: req.query.getAll("functions")
        }
      };
    }

    const begin = req.query.has("begin") ? new Date(req.query.get("begin")) : new Date();
    // 'new Date' adds current miliseconds if the given parameter(req.query.get("begin") for this case) missing miliseconds
    begin.setMilliseconds(0);
    // we should apply this manipulation to the request object too,
    // in order to find it on change streams when disconnection
    req.query.set("begin", begin);

    options.filter = {
      ...options.filter,
      created_at: {
        $gte: begin
      }
    };

    if (req.query.has("content")) {
      options.filter = {
        ...options.filter,
        content: {$regex: req.query.get("content"), $options: "i"}
      };
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
