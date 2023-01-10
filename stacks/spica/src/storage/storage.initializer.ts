import {Injectable} from "@angular/core";
import {RootDirService} from "./services/root.dir.service";
import {RemoveCategory, RouteCategory, RouteService, Upsert} from "@spica-client/core";
import {PassportService} from "@spica-client/passport";

@Injectable()
export class StorageInitializer {
  constructor(
    private rootDirService: RootDirService,
    private routeService: RouteService,
    private passport: PassportService
  ) {
    rootDirService.watch().subscribe(storages => {
      routeService.dispatch(new RemoveCategory(RouteCategory.Storage));
      for (const storage of storages) {
        this.routeService.dispatch(
          new Upsert({
            category: RouteCategory.Storage,
            id: storage._id,
            icon: "folder",
            path: `/storage/${storage.name}`,
            display: storage.name
          })
        );
      }

      routeService.dispatch(
        new Upsert({
          id: "storages",
          category: RouteCategory.Storage,
          icon: "folder",
          path: "/storages",
          display: "/",
          data: {
            action: "storage:index"
          }
        })
      );

      routeService.dispatch(
        new Upsert({
          id: "add-storage",
          category: RouteCategory.Storage,
          icon: "add",
          path: "/storage/welcome",
          display: "Add New Directory",
          customClass: "dashed-item",
          queryParams: {openDialog: true}
        })
      );
    });
  }

  async appInitializer() {
    const allowed = await this.passport.checkAllowed("storage:index", "*").toPromise();
    if (this.passport.identified && allowed) {
      this.rootDirService.findAll().toPromise();
    } else {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Storage));
    }
  }
}
