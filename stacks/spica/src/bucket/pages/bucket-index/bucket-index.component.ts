import {Component, Input, OnDestroy, OnInit} from "@angular/core";
import {Subject} from "rxjs";
import {BucketService} from "../../services/bucket.service";
import {filter, takeUntil} from "rxjs/operators";
import {Router} from "@angular/router";
import {Route} from "@spica-client/core";
import {MatDialog} from "@angular/material/dialog";
import {AddBucketComponent} from "@spica-client/bucket/components/add-bucket/add-bucket.component";
import {Bucket} from "@spica-client/bucket/interfaces/bucket";

@Component({
  selector: "bucket-index",
  templateUrl: "./bucket-index.component.html",
  styleUrls: ["./bucket-index.component.scss"]
})
export class BucketIndexComponent implements OnDestroy, OnInit {
  buckets: Bucket[];
  private dispose = new Subject();
  @Input() route: Route;

  constructor(private bs: BucketService, private router: Router, private dialog: MatDialog) {
    this.bs
      .getBuckets()
      .pipe(
        takeUntil(this.dispose),
        filter((data: any) => data && data.length)
      )
      .subscribe(data => {
        this.buckets = data;
      });
  }

  ngOnInit() {}

  delete(id: string) {
    const index = this.buckets.findIndex(b => b._id == id);

    const currentBucketRoute = this.router.routerState.snapshot.url.split("/")[2];
    let target = currentBucketRoute;

    if (this.buckets.length > 1) {
      if (currentBucketRoute == id) {
        const nextIndex = index == 0 ? index + 1 : index - 1;
        target = this.buckets[nextIndex]._id;
      }
    } else {
      target = "welcome";
    }

    this.bs
      .delete(id)
      .toPromise()
      .then(() => target && this.router.navigate(["bucket", target]));
  }

  editBucket() {
    this.dialog.open(AddBucketComponent, {
      data: {
        bucket: this.buckets.find(item => item._id == this.route.id)
      },
      autoFocus: false
    });
  }
  ngOnDestroy(): void {
    this.dispose.next();
  }
}
