import {EventEmitter, Injectable, Output} from "@angular/core";
import {
  Add,
  CherryPickAndRemove,
  RemoveCategory,
  RouteCategory,
  RouteService,
  Upsert
} from "@spica-client/core/route";
import {PassportService} from "@spica-client/passport";
import {ConfigurationComponent} from "./components/configuration/configuration.component";
import {FunctionActionsComponent} from "./pages/function-actions/function-actions.component";
import {FunctionService} from "./services/function.service";

@Injectable()
export class FunctionInitializer {
  @Output() onFunctionCategoryChange = new EventEmitter();
  constructor(
    private functionService: FunctionService,
    private routeService: RouteService,
    private passport: PassportService
  ) {
    this.routeService.patchCategory(RouteCategory.Developer, {
      props: {
        moreTemplate: FunctionActionsComponent,
        onChangedOrder: this.onFunctionCategoryChange,
        categoryStorageKey: RouteCategory.Developer
      }
    });
    this.onFunctionCategoryChange.subscribe(event => this.functionService.patchFunctionMany(event));

    functionService.getFunctions().subscribe(async funcs => {
      this.routeService.dispatch(
        new CherryPickAndRemove(e => e.category == RouteCategory.Developer)
      );
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Developer));

      for (const func of funcs) {
        const permissions = await Promise.all([
          this.passport.checkAllowed("function:show", func._id).toPromise(),
          this.passport.checkAllowed("function:index", func._id).toPromise()
        ]);
        if (permissions.every(p => p == true)) {
          this.routeService.dispatch(
            new Upsert({
              category: RouteCategory.Developer,
              id: func._id,
              icon: "memory",
              path: `/function/${func._id}`,
              display: func.name,
              resource_category: func.category,
              draggable: true,
              has_more: true
            })
          );
        }
      }
      this.routeService.dispatch(
        new Upsert({
          id: "add-function",
          category: RouteCategory.Developer,
          icon: "add",
          path: ConfigurationComponent,
          display: "Add New Function",
          index: Number.MAX_SAFE_INTEGER,
          data: {
            action: "function:create"
          },
          customClass: "dashed-item"
        })
      );
    });
  }

  async appInitializer() {
    if (!this.passport.identified) {
      return;
    }

    const functionIndex = await this.passport.checkAllowed("function:index", "*").toPromise();

    if (!functionIndex) {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Developer));
      return;
    }

    this.functionService.loadFunctions().toPromise();

    const functionLog = (await functionIndex)
      ? this.passport.checkAllowed("function:logs:index").toPromise()
      : Promise.resolve(false);

    if (!functionLog) {
      this.routeService.dispatch(new CherryPickAndRemove(e => e.id == "list_all_logs"));
    }
  }
}
