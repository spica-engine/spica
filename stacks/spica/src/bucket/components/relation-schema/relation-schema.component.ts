import {Component, Inject} from "@angular/core";
import {INPUT_SCHEMA} from "@spica-client/common";
import {Observable} from "rxjs";
import {BucketService} from "../../services/bucket.service";
import {Bucket} from "../../interfaces/bucket";
import {RelationSchema} from "../relation";

@Component({
  selector: "bucket-relation",
  templateUrl: "./relation-schema.component.html",
  styleUrls: ["./relation-schema.component.scss"]
})
export class RelationSchemaComponent {
  public buckets: Observable<Bucket[]>;

  constructor(@Inject(INPUT_SCHEMA) public schema: RelationSchema, bucketService: BucketService) {
    this.buckets = bucketService.getBuckets();
  }
}
