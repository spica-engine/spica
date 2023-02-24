import {EventEmitter, Injectable, Output} from "@angular/core";
import {RemoveCategory, RouteCategory, RouteService, Upsert} from "@spica-client/core";
import {PassportService} from "../../passport";
import {AddBucketComponent} from "../components/add-bucket/add-bucket.component";
import {BucketActionsComponent} from "../pages/bucket-actions/bucket-actions.component";
import {BucketService} from "./bucket.service";

@Injectable()
export class BucketInitializer {
  categoryStorageKey: string = RouteCategory.Content;
  @Output() onBucketCategoryChange = new EventEmitter<
    {
      id: string;
      changes: object;
    }[]
  >();
  buckets = [];
  constructor(
    private bs: BucketService,
    private routeService: RouteService,
    private passport: PassportService
  ) {
    this.routeService.patchCategory(RouteCategory.Content, {
      props: {
        moreTemplate: BucketActionsComponent,
        onChangedOrder: this.onBucketCategoryChange,
        categoryStorageKey: this.categoryStorageKey
      }
    });

    this.onBucketCategoryChange.subscribe(event => this.bs.patchBucketMany(event));
    bs.getBuckets().subscribe(async buckets => {
      this.routeService.dispatch(new RemoveCategory(RouteCategory.Content));
      this.buckets = buckets;
      for (const bucket of buckets) {
        const allowed = await this.passport
          .checkAllowed("bucket:data:index", `${bucket._id}/*`)
          .toPromise();
        if (allowed) {
          this.routeService.dispatch(
            new Upsert({
              category: RouteCategory.Content,
              id: bucket._id,
              icon: bucket.icon,
              path: `/bucket/${bucket._id}`,
              display: bucket.title,
              resource_category: bucket.category,
              draggable: true,
              has_more: true,
              index: bucket.order
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
          index: Number.MAX_SAFE_INTEGER,
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
