import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import * as passport from "passport";

class _NoopStrategy extends passport.Strategy {
  constructor(private callback: (req) => void) {
    super();
  }

  authenticate(req: any) {
    req.TESTING_SKIP_CHECK = true;
    this.callback((err, user, reason) => {
        if (err) {
          this["error"](err);
        } else if (!user) {
          this["fail"](reason);
        } else {
          this["success"](user, reason);
        }
      });
  }
}

@Injectable()
export class NoopStrategy extends PassportStrategy(_NoopStrategy, "noop") {
  validate() {
    return Promise.resolve({identifier: "noop", policies: []});
  }
}
