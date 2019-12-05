import {Injectable} from "@nestjs/common";
import {AbstractStrategy, PassportStrategy} from "@nestjs/passport";

export class MixinNoopStrategy extends AbstractStrategy {
  validate(...args: any[]) {
    return Promise.resolve({identifier: "noop"});
  }

  authenticate(req: any) {
    req.user = {identifier: "noop"};
    this["success"]({identifier: "noop"}, {});
  }
}

@Injectable()
export class NoopStrategy extends PassportStrategy(MixinNoopStrategy, "noop") {}
