import {Injectable} from "@nestjs/common";
import {PassportStrategy} from "@nestjs/passport";
import * as passport from "passport";
import {TestingOptions} from "./interface";

class _NoopStrategy extends passport.Strategy {
  constructor(
    private options: TestingOptions,
    private callback: (req) => void
  ) {
    super();
  }

  authenticate(req: any) {
    req.TESTING_SKIP_CHECK = this.options.skipActionCheck;
    this.callback((err, user, reason) => {
      if (err) {
        this["error"](err);
      } else if (!user) {
        this["fail"](reason);
      } else {
        this["success"](user, reason);
        if (this.options.overriddenStrategyType) {
          req.strategyType = this.options.overriddenStrategyType;
        }
      }
    });
  }
}

@Injectable()
export class NoopStrategy extends PassportStrategy(_NoopStrategy, "noop") {
  constructor(options: TestingOptions) {
    super(options);
    if (options.overriddenStrategyType) {
      passport["_strategies"][options.overriddenStrategyType.toLowerCase()] =
        passport["_strategies"].noop;
    }
  }
  validate() {
    return Promise.resolve({identifier: "noop", policies: []});
  }
}
