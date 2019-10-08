import {Injectable} from "@nestjs/common";
import {PassportStrategy} from "@nestjs/passport";
import {AbstractStrategy} from "@nestjs/passport";

export class MixinNoopStrategy extends AbstractStrategy {
  validate(...args: any[]) {
    return {identifier: "noop"};
  }
}

@Injectable()
export class NoopStrategy extends PassportStrategy(MixinNoopStrategy, "noop") {}
