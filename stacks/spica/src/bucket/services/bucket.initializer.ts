import {Injectable} from "@angular/core";
import {RemoveCategory, RouteCategory, RouteService, Upsert} from "@spica-client/core";
import {PassportService} from "../../passport";
import {BucketService} from "./bucket.service";

@Injectable()
export class BucketInitializer {
  constructor(
    private bs: BucketService,
    private routeService: RouteService,
    private passport: PassportService
  ) {
    bs.getBuckets().subscribe(buckets => {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Content));
      buckets.forEach(bucket => {
        this.routeService.dispatch(
          new Upsert({
            category: RouteCategory.Content,
            id: `bucket_${bucket._id}`,
            icon: bucket.icon,
            path: `/bucket/${bucket._id}`,
            display: bucket.title
          })
        );
      });
    });
  }

  async appInitializer() {
    if (
      this.passport.identified &&
      (await this.passport.checkAllowed("bucket:index").toPromise())
    ) {
      this.bs.retrieve().toPromise();
    } else {
      // Clean up the content category if the user has no permission to see.
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Content));
    }
  }
}
