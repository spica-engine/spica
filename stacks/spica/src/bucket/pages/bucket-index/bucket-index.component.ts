import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {Component, OnDestroy} from "@angular/core";
import {Observable, Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {BucketService} from "../../services/bucket.service";
import {Bucket} from "../../interfaces/bucket";

@Component({
  selector: "bucket-index",
  templateUrl: "./bucket-index.component.html",
  styleUrls: ["./bucket-index.component.scss"]
})
export class BucketIndexComponent implements OnDestroy {
  public $buckets: Observable<Bucket[]>;
  public columns: number = 4;

  private dispose = new Subject();

  constructor(private bs: BucketService, public breakpointObserver: BreakpointObserver) {
    this.$buckets = this.bs.getBuckets();

    this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Medium, Breakpoints.Small])
      .pipe(takeUntil(this.dispose))
      .subscribe(() => {
        this.breakpointObserver.isMatched(Breakpoints.XSmall)
          ? (this.columns = 1)
          : this.breakpointObserver.isMatched(Breakpoints.Small)
          ? (this.columns = 3)
          : this.breakpointObserver.isMatched(Breakpoints.Medium)
          ? (this.columns = 3)
          : (this.columns = 4);
      });
  }

  delete(bucket: Bucket): void {
    this.bs.delete(bucket._id).toPromise();
  }

  ngOnDestroy(): void {
    this.dispose.next();
  }
}
