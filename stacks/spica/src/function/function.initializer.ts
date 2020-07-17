import {Injectable} from "@angular/core";
import {RemoveCategory, RouteCategory, RouteService, Upsert} from "@spica-client/core/route";
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
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Function));
      this.routeService.dispatch(
        new Upsert({
          category: RouteCategory.Function,
          id: `list_all_functions`,
          icon: "format_list_numbered",
          path: `/function`,
          display: "Functions"
        })
      );
      this.routeService.dispatch(
        new Upsert({
          category: RouteCategory.Function,
          id: `list_all_logs`,
          icon: "pest_control",
          path: "/function/logs",
          display: "Logs",
          queryParams: {function: funcs.map(func => func._id), showErrors: true}
        })
      );
      funcs.forEach(func => {
        this.routeService.dispatch(
          new Upsert({
            category: RouteCategory.Function,
            id: `${func._id}`,
            icon: "memory",
            path: `/function/${func._id}`,
            display: func.name
          })
        );
      });
    });
  }
  async appInitializer() {
    if (
      this.passport.identified &&
      (await this.passport.checkAllowed("function:index").toPromise())
    ) {
      this.functionService.loadFunctions().toPromise();
    } else {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Function));
    }
  }
}
