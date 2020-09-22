import {Injectable} from "@angular/core";
import {
  CherryPickAndRemove,
  RemoveCategory,
  RouteCategory,
  RouteService,
  Upsert
} from "@spica-client/core/route";
import {PassportService} from "@spica-client/passport";
import {FunctionService} from "./function.service";

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
        this.routeService.dispatch(
          new Upsert({
            category: RouteCategory.Function,
            id: func._id,
            icon: "memory",
            path: `/function/${func._id}`,
            display: func.name
          })
        );
      });
    });
  }

  async appInitializer() {
    const allowed = await this.passport.checkAllowed("function:index", "*").toPromise();
    if (this.passport.identified && allowed) {
      this.functionService.loadFunctions().toPromise();
    } else {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Function));
    }
  }
}
