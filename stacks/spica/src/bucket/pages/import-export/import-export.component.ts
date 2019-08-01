import {Component, OnInit} from "@angular/core";
import {saveAs} from "file-saver";
import {switchMap, tap} from "rxjs/operators";
import {BucketService} from "../../services/bucket.service";
import {Bucket, BucketTemplate} from "../../interfaces/bucket";

@Component({
  selector: "import-export",
  templateUrl: "./import-export.component.html",
  styleUrls: ["./import-export.component.scss"]
})
export class ImportExportComponent implements OnInit {
  public buckets: Bucket[];
  public templates: {[key: string]: BucketTemplate};

  constructor(private bucketService: BucketService) {}

  ngOnInit() {
    this.bucketService
      .getTemplates()
      .pipe(
        tap(templates => (this.templates = templates)),
        switchMap(() => this.bucketService.getBuckets())
      )
      .subscribe(buckets => (this.buckets = buckets));
  }

  export(bucketIds: Array<string>): void {
    this.bucketService
      .exportData(bucketIds)
      .toPromise()
      .then(data => {
        saveAs(data, `export.zip`);
      });
  }

  import(file: File, bucketId: string): void {
    this.bucketService.importData(file, bucketId).toPromise();
  }

  exportSchema(bucketIds: Array<string>) {
    this.bucketService
      .exportSchema(bucketIds)
      .toPromise()
      .then(data => {
        saveAs(data, `export.zip`);
      });
  }
  importSchema(file: File) {
    this.bucketService.importSchema(file).toPromise();
  }
  // create(templateId: string): void {
  //   this.bucketService
  //     .createFromTemplate(this.templates[templateId])
  //     .subscribe(data => {
  //       console.log(data);
  //     });
  // }
}
