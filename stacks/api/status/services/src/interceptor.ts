import {Injectable, NestInterceptor, ExecutionContext, CallHandler} from "@nestjs/common";
import {Observable} from "rxjs";
import {StatusService} from "./service";

@Injectable()
export class StatusInterceptor implements NestInterceptor {
  constructor(private service: StatusService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const send = res.send;
    res.send = payload => {
      const reqSize = parseInt(req.get("Content-Length")) || 0;
      const resSize = Buffer.byteLength(payload ? payload : "");
      this.service.insertOne({
        request: {
          size: reqSize
        },
        response: {
          size: resSize
        }
      });

      send.bind(res)(payload);
    };

    return next.handle();
  }
}
