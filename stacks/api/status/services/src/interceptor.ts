import {Injectable, NestInterceptor, ExecutionContext, CallHandler} from "@nestjs/common";
import {Observable} from "rxjs";
import {StatusService} from "./service";

@Injectable()
export class StatusInterceptor implements NestInterceptor {
  constructor(private service: StatusService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const reqSize = req.get("Content-Length");
    this.service.increase("request", parseInt(reqSize)).catch(console.debug);

    const send = res.send;
    res.send = payload => {
      const resSize = Buffer.byteLength(payload);
      this.service.increase("response", resSize).catch(console.debug);

      send.bind(res)(payload);
    };

    return next.handle();
  }
}
