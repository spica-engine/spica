import {OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway} from "@nestjs/websockets";
import {RealtimeDatabaseService} from "@spica-server/database/realtime";
import {GuardService} from "@spica-server/passport";
import {fromEvent, of} from "rxjs";
import {catchError, takeUntil} from "rxjs/operators";

@WebSocketGateway(31, {
  path: "/function-logs"
})
export class LogGateway implements OnGatewayConnection, OnGatewayDisconnect {
  readonly COLLECTION = "function_logs";

  constructor(
    private realtime: RealtimeDatabaseService,
    private guardService: GuardService
  ) {}

  async handleDisconnect(client: any) {
    const options = await this.prepareOptions(client, client.upgradeReq);

    if (this.realtime.doesEmitterExist(this.COLLECTION, options)) {
      this.realtime.removeEmitter(this.COLLECTION, options);
    }
  }

  async handleConnection(client: WebSocket, req) {
    req.headers.authorization = req.headers.authorization || req.query.get("Authorization");

    try {
      await this.guardService.checkAuthorization({
        request: req,
        response: client
      });
    } catch (e) {
      client.send(JSON.stringify({code: e.status || 500, message: e.message}));
      return client.close(1003);
    }

    const options = await this.prepareOptions(client, req);

    const stream = this.realtime.find("function_logs", options).pipe(
      catchError(e => {
        client.send(JSON.stringify({code: e.status || 500, message: e.message}));
        client.close(1003);

        return of(null);
      })
    );

    stream
      .pipe(takeUntil(fromEvent(client, "close")))
      .subscribe(data => client.send(JSON.stringify(data)));
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
