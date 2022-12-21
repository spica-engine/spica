import {Injectable} from "@angular/core";
import {StorageService} from "./storage.service";
import {RemoveCategory, RouteCategory, RouteService, Upsert} from "@spica-client/core";
import {PassportService} from "@spica-client/passport";

@Injectable()
export class StorageInitializer {
  constructor(
    private service: StorageService,
    private routeService: RouteService,
    private passport: PassportService
  ) {
    //prettier-ignore
    const listRootFoldersRegex = "/^\/[^\/]+\/$|^[^\/]+\/$"
    this.service.getAll({name: {$regex: listRootFoldersRegex}}).subscribe(storages => {
      console.log(storages);
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Storage));
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

      this.routeService.dispatch(
        new Upsert({
          id: "add-storage",
          category: RouteCategory.Storage,
          icon: "add",
          path: "/storage/add",
          display: "Add New Folder",
          data: {
            action: "storage:create"
          }
        })
      );
    });
  }

  async appInitializer() {
    const allowed = await this.passport.checkAllowed("storage:index", "*").toPromise();
    if (this.passport.identified && allowed) {
      this.service.getAll().toPromise();
    } else {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Storage));
    }
  }
}
