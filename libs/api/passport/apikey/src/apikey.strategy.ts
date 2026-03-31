import {Injectable} from "@nestjs/common";
import {PassportStrategy} from "@nestjs/passport";
import passport from "passport";
import {ExtractJwt} from "passport-jwt";
import {ApiKeyService} from "./apikey.service";

class _ApiKeyStrategy extends passport.Strategy {
  constructor(
    private tokenExtractor: (req) => string,
    private callback: Function
  ) {
    super();
  }

  authenticate(req: any) {
    const token = this.tokenExtractor(req);
    if (!token) {
      this["fail"](new Error("No auth token"));
    } else {
      this.callback(token, (err, key, reason) => {
        if (err) {
          this["error"](err);
        } else if (!key) {
          this["fail"](reason);
        } else {
          this["success"](key, reason);
        }
      });
    }
  }
}

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(_ApiKeyStrategy, "apikey") {
  constructor(private apiKeyService: ApiKeyService) {
    super(ExtractJwt.fromAuthHeaderWithScheme("APIKEY"));
  }
  async validate(key: string) {
    return this.apiKeyService.findOne({
      key,
      active: true
    });
  }
}
