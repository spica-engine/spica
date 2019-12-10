import {Injectable} from "@nestjs/common";
import {AbstractStrategy, PassportStrategy} from "@nestjs/passport";

export class MixinNoopStrategy extends AbstractStrategy {
  validate(...args: any[]) {
    return Promise.resolve({identifier: "noop"});
  }

  authenticate(req: any) {
    req.TESTING_SKIP_CHECK = true;
    this["success"]({identifier: "noop", policies: []}, {});
  }
}

@Injectable()
export class NoopStrategy extends PassportStrategy(MixinNoopStrategy, "noop") {}
