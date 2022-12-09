import {Injectable} from "@angular/core";
import {RemoveCategory, RouteCategory, RouteService, Upsert} from "@spica-client/core";
import {PassportService} from "../../passport";
import {AddBucketComponent} from "../pages/add-bucket/add-bucket.component";
import {BucketService} from "./bucket.service";

@Injectable()
export class BucketInitializer {
  constructor(
    private bs: BucketService,
    private routeService: RouteService,
    private passport: PassportService
  ) {
    bs.getBuckets().subscribe(async buckets => {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Content));
      for (const bucket of buckets) {
        const allowed = await this.passport
          .checkAllowed("bucket:data:index", `${bucket._id}/*`)
          .toPromise();
        if (allowed) {
          this.routeService.dispatch(
            new Upsert({
              category: RouteCategory.Content,
              id: `bucket_${bucket._id}`,
              icon: bucket.icon,
              path: `/bucket/${bucket._id}`,
              display: bucket.title,
              resource_category: bucket.category
            })
          );
        }
      }
      this.routeService.dispatch(
        new Upsert({
          id: "add-bucket",
          category: RouteCategory.Content,
          icon: "add",
          path: AddBucketComponent,
          display: "Add New Bucket",
          data: {
            action: "bucket:create"
          },
          customClass: "dashed-item"
        })
      );
    });
  }

  async appInitializer() {
    const allowed = await this.passport.checkAllowed("bucket:index", "*").toPromise();
    if (this.passport.identified && allowed) {
      this.bs.retrieve().toPromise();
    } else {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Content));
    }
  }
}
