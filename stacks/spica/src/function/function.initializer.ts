import {FunctionService} from "./function.service";
import {Injectable} from "@angular/core";
import {RouteService, RemoveCategory, RouteCategory, Upsert} from "@spica-server/core/route";
import {PassportService} from "src/passport";

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
          id: `list_all`,
          icon: "format_list_numbered",
          path: `/function`,
          display: "List All"
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
