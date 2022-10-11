import {Component, Input, OnDestroy, ViewChild, OnInit} from "@angular/core";
import {Subject} from "rxjs";
import {Bucket} from "../../interfaces/bucket";
import {BucketService} from "../../services/bucket.service";
import {filter, takeUntil} from "rxjs/operators";
import {ActivatedRoute, Router} from "@angular/router";
import {RouteCategory} from "@spica-client/core/route";

@Component({
  selector: "bucket-index",
  templateUrl: "./bucket-index.component.html",
  styleUrls: ["./bucket-index.component.scss"]
})
export class BucketIndexComponent implements OnDestroy, OnInit {
  categoryStorageKey: string = RouteCategory.Content;
  buckets;
  selectedItem: Bucket;
  private dispose = new Subject();
  @Input() sideCar = false;

  constructor(
    private bs: BucketService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.bs
      .getBuckets()
      .pipe(filter((data: any) => data && data.length))
      .subscribe(data => {
        this.buckets = data;
      });
  }

  ngOnInit() {
    this.activatedRoute.url.pipe(takeUntil(this.dispose)).subscribe(segments => {
      if (!segments.length) {
        const target = this.buckets.length ? this.buckets[0]._id : "add";
        this.router.navigate(["buckets", target]);
      }
    });
  }

  delete(bucket: Bucket) {
    const index = this.buckets.findIndex(b => b._id == bucket._id);

    const lastSegment = this.activatedRoute.snapshot.url[
      this.activatedRoute.snapshot.url.length - 1
    ].toString();

    let target = lastSegment;

    if (lastSegment == bucket._id) {
      if (this.buckets.length > 1) {
        const nextIndex = index == 0 ? index + 1 : index - 1;
        target = this.buckets[nextIndex]._id;
      } else {
        target = "welcome";
      }
    }

    this.bs
      .delete(bucket._id)
      .toPromise()
      .then(() => this.router.navigate(["buckets", target]));
  }

  ngOnDestroy(): void {
    this.dispose.next();
  }

  updateIndexes(event) {
    event.forEach(item => this.bs.patchBucket(item.entry_id, item.changes).toPromise());
  }
}
