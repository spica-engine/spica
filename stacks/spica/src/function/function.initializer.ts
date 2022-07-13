import {Injectable} from "@angular/core";
import {
  CherryPickAndRemove,
  RemoveCategory,
  RouteCategory,
  RouteService,
  Upsert
} from "@spica-client/core/route";
import {PassportService} from "@spica-client/passport";
import {FunctionService} from "./services/function.service";

@Injectable()
export class FunctionInitializer {
  constructor(
    private functionService: FunctionService,
    private routeService: RouteService,
    private passport: PassportService
  ) {
    functionService.getFunctions().subscribe(funcs => {
      this.routeService.dispatch(
        new CherryPickAndRemove(e => e.icon == "memory" && /\/function\//.test(e.path))
      );

      funcs.forEach(func => {
        Promise.all([
          this.passport.checkAllowed("function:show", func._id).toPromise(),
          this.passport.checkAllowed("function:index", func._id).toPromise()
        ]).then(permissions => {
          if (permissions.every(p => p == true)) {
            this.routeService.dispatch(
              new Upsert({
                category: RouteCategory.Developer,
                id: func._id,
                icon: "memory",
                path: `/function/${func._id}`,
                display: func.name,
                group: func.category
              })
            );
          }
        });
      });
    });
  }

  async appInitializer() {
    if (!this.passport.identified) {
      return;
    }

    const [functionIndex, webhookIndex] = await Promise.all([
      this.passport.checkAllowed("function:index", "*").toPromise(),
      this.passport.checkAllowed("webhook:index", "*").toPromise()
    ]);

    if (!functionIndex && !webhookIndex) {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Developer));
      return;
    }

    if (functionIndex) {
      this.functionService.loadFunctions().toPromise();
    }

    const [functionLog, webhookLog] = await Promise.all([
      functionIndex
        ? this.passport.checkAllowed("function:logs:index").toPromise()
        : Promise.resolve(false),
      webhookIndex
        ? this.passport.checkAllowed("webhook:logs:index").toPromise()
        : Promise.resolve(false)
    ]);

    if (!functionLog && !webhookLog) {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Developer_Sub));
    } else if (!functionLog) {
      this.routeService.dispatch(new CherryPickAndRemove(e => e.id == "list_all_logs"));
    } else if (!webhookLog) {
      this.routeService.dispatch(new CherryPickAndRemove(e => e.id == "webhook_logs"));
    }
  }
}
