import {Component, Inject, OnInit} from "@angular/core";
import {MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA} from "@angular/material/legacy-dialog";
import {Router} from "@angular/router";
import {Bucket, emptyBucket} from "@spica-client/bucket/interfaces/bucket";
import {BucketService} from "@spica-client/bucket/services/bucket.service";
import {ICONS, SavingState} from "@spica-client/material";
import {merge, Observable, of} from "rxjs";
import {catchError, endWith, ignoreElements, take, tap} from "rxjs/operators";

@Component({
  selector: "app-add-bucket",
  templateUrl: "./add-bucket.component.html",
  styleUrls: ["./add-bucket.component.scss"]
})
export class AddBucketComponent implements OnInit {
  icons: Array<string> = ICONS;
  buckets: Bucket[];
  bucket: Bucket;
  $save: Observable<SavingState>;
  searchIconText: string = "";
  readonly iconPageSize = 24;
  visibleIcons: Array<any> = this.icons.slice(0, this.iconPageSize);

  constructor(
    private bs: BucketService,
    private router: Router,
    @Inject(MAT_DIALOG_DATA) public data: {bucket: Bucket},
    public dialogRef: MatDialogRef<AddBucketComponent>
  ) {
    this.bs
      .getBuckets()
      .pipe(take(1))
      .subscribe(buckets => (this.buckets = buckets));
  }

  ngOnInit(): void {
    this.bucket = this.data && this.data.bucket ? this.data.bucket : emptyBucket();
  }

  saveBucket() {
    const isInsert = !this.bucket._id;

    if (!this.bucket.hasOwnProperty("order")) {
      this.bucket.order = this.buckets.length;
    }

    const save = isInsert ? this.bs.insertOne(this.bucket) : this.bs.replaceOne(this.bucket);

    this.$save = merge(
      of(SavingState.Saving),
      save.pipe(
        tap(bucket => isInsert && this.router.navigate(["bucket", bucket._id])),
        ignoreElements(),
        endWith(SavingState.Saved),
        catchError(() => of(SavingState.Failed)),
        tap(() => this.dialogRef.close())
      )
    );
  }

  setIcons(event = {pageIndex: 0, pageSize: this.iconPageSize}) {
    this.icons = ICONS.filter(icon => icon.includes(this.searchIconText.toLowerCase()));

    this.visibleIcons = this.icons.slice(
      event.pageIndex * event.pageSize,
      (event.pageIndex + 1) * event.pageSize
    );
  }
}
