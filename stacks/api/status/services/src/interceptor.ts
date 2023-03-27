import {Injectable, NestInterceptor, ExecutionContext, CallHandler} from "@nestjs/common";
import {Observable} from "rxjs";
import {AttachStatusTracker} from "./interface";
import {StatusService} from "./service";

@Injectable()
export class StatusInterceptor implements NestInterceptor {
  constructor(private service: StatusService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    attachStatusTrackerFactory(this.service)(req, res);

    return next.handle();
  }
}

export function attachStatusTrackerFactory(service: StatusService): AttachStatusTracker {
  const calculatePayloadSize = (payload: string) => {
    return Buffer.byteLength(payload ? payload : "");
  };

  const interceptMethod = (obj: object, methodName: string, intercept: (arg) => void) => {
    const actual = obj[methodName];
    obj[methodName] = arg => {
      intercept(arg);
      return actual.bind(obj)(arg);
    };
  };

  return (req, res) => {
    const reqSize = parseInt(req.get("Content-Length")) || 0;

    let resSize = 0;
    let statusSaved = false;

    const saveStatus = () => {
      if (statusSaved) {
        return;
      }
      statusSaved = true;
      service
        .insertOne({
          request: {
            size: reqSize
          },
          response: {
            size: resSize
          }
        })
        .catch(e => console.error(e));
    };

    interceptMethod(res, "write", payload => (resSize += calculatePayloadSize(payload)));
    interceptMethod(res, "end", payload => {
      resSize += calculatePayloadSize(payload);
      saveStatus();
    });
    interceptMethod(res, "send", payload => {
      resSize = calculatePayloadSize(payload);
      saveStatus();
    });
  };
}
