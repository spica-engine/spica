import {Inject, Injectable, Optional} from "@nestjs/common";
import {AuthModuleOptions} from "@nestjs/passport";
import {ActionGuard, AuthGuard} from "@spica-server/passport/guard";
import {from, Observable} from "rxjs";
import {
  PolicyResolver,
  POLICY_RESOLVER,
  IGuardService
} from "@spica-server/interface/passport/guard";

@Injectable()
export class GuardService implements IGuardService {
  constructor(
    @Optional() @Inject(POLICY_RESOLVER) private resolver: PolicyResolver<any>,
    @Optional() private readonly options?: AuthModuleOptions
  ) {}

  private wrapResult(result: boolean | Promise<boolean> | Observable<boolean>): Promise<boolean> {
    if (typeof result == "boolean") {
      return Promise.resolve(result);
    }
    return from(result).toPromise();
  }

  checkAction({
    request,
    response,
    actions,
    options
  }: {
    request: any;
    response: any;
    actions: string | string[];
    options?: {resourceFilter: boolean};
  }): Promise<boolean> {
    const guard = ActionGuard(actions, undefined, undefined, options);
    return this.wrapResult(
      new guard(this.resolver).canActivate({
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => response,
          getNext: () => undefined
        }),
        getArgByIndex: undefined,
        getArgs: undefined,
        getClass: undefined,
        getHandler: undefined,
        getType: undefined,
        switchToRpc: undefined,
        switchToWs: undefined
      })
    );
  }

  checkAuthorization({request, response, type}: {request: any; response: any; type?: string}) {
    const guard = AuthGuard(type);
    return this.wrapResult(
      new guard(this.options).canActivate({
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => response,
          getNext: () => undefined
        }),
        getArgByIndex: undefined,
        getArgs: undefined,
        getClass: undefined,
        getHandler: undefined,
        getType: undefined,
        switchToRpc: undefined,
        switchToWs: undefined
      })
    );
  }
}
