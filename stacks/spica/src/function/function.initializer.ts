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
      // Clean up the content category if the user has no permission to see.
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Function));
    }
  }
}
