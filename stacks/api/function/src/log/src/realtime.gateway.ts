import {OnGatewayConnection, WebSocketGateway} from "@nestjs/websockets";
import {ObjectId} from "@spica-server/database";
import {RealtimeDatabaseService, StreamChunk} from "@spica-server/database/realtime";
import {AuthGuardService} from "@spica-server/passport";
import {fromEvent, Observable} from "rxjs";
import {takeUntil, tap} from "rxjs/operators";

@WebSocketGateway(31, {
  path: "/function/logs"
})
export class LogGateway implements OnGatewayConnection {
  streams = new Map<string, Observable<StreamChunk<any>>>();

  constructor(
    private realtime: RealtimeDatabaseService,
    private authGuardService: AuthGuardService
  ) {}

  async handleConnection(client: WebSocket, req) {
    req.headers.authorization = req.headers.authorization || req.query.get("Authorization");

    try {
      await this.authGuardService.check(req, client);
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

    let begin = new Date(new Date().setUTCHours(0, 0, 0, 0));
    let end = new Date(new Date().setUTCHours(23, 59, 59, 999));

    if (req.query.has("begin") && req.query.has("end")) {
      begin = new Date(req.query.get("begin"));
      end = new Date(req.query.get("end"));
    }

    options.filter = {
      ...options.filter,
      _id: {
        $gte: ObjectId.createFromTime(begin.getTime() / 1000),
        $lt: ObjectId.createFromTime(end.getTime() / 1000)
      }
    };

    if (req.query.has("sort")) {
      try {
        options.sort = JSON.parse(req.query.get("sort"));
      } catch (error) {
        console.log(error);
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
      stream = this.realtime.find("function_logs", options).pipe(
        tap({
          complete: () => this.streams.delete(cursorName)
        })
      );

      this.streams.set(cursorName, stream);
    }

    stream.pipe(takeUntil(fromEvent(client, "close"))).subscribe(data => {
      client.send(JSON.stringify(data));
    });
  }
}
