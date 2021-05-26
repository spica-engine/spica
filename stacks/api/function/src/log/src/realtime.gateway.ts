import {OnGatewayConnection, WebSocketGateway} from "@nestjs/websockets";
import {RealtimeDatabaseService, StreamChunk} from "@spica-server/database/realtime";
import {GuardService} from "@spica-server/passport";
import {fromEvent, Observable, of} from "rxjs";
import {catchError, takeUntil, tap} from "rxjs/operators";

@WebSocketGateway(31, {
  path: "/function/logs"
})
export class LogGateway implements OnGatewayConnection {
  streams = new Map<string, Observable<StreamChunk<any>>>();

  constructor(private realtime: RealtimeDatabaseService, private guardService: GuardService) {}

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

    const options: any = {};

    if (req.query.has("functions")) {
      options.filter = {
        function: {
          $in: req.query.getAll("functions")
        }
      };
    }

    const begin = req.query.has("begin") ? new Date(req.query.get("begin")) : new Date();

    options.filter = {
      ...options.filter,
      created_at: {
        $gte: begin
      }
    };

    if (req.query.has("sort")) {
      try {
        options.sort = JSON.parse(req.query.get("sort"));
      } catch (e) {
        client.send(JSON.stringify({code: 400, message: e.message}));
      }
    }

    if (req.query.has("limit")) {
      options.limit = Number(req.query.get("limit"));
    }

    if (req.query.has("skip")) {
      options.skip = Number(req.query.get("skip"));
    }

    const cursorName = `${JSON.stringify(options)}`;
    let stream = this.streams.get(cursorName);

    if (!stream) {
      stream = this.realtime.find("function_logs", options, true).pipe(
        catchError(e => {
          client.send(JSON.stringify({code: e.status || 500, message: e.message}));
          client.close(1003);

          this.streams.delete(cursorName);

          return of(null);
        }),
        tap({
          complete: () => {
            this.streams.delete(cursorName);
          }
        })
      );

      this.streams.set(cursorName, stream);
    }

    stream.pipe(takeUntil(fromEvent(client, "close"))).subscribe(data => {
      client.send(JSON.stringify(data));
    });
  }
}
