import {Component, Inject} from "@angular/core";
import {INPUT_SCHEMA} from "@spica-client/common";
import {Observable} from "rxjs";
import {BucketService} from "../../services/bucket.service";
import {Bucket} from "../../interfaces/bucket";
import {RelationSchema, RelationType} from "../relation";
import {tap} from "rxjs/operators";

@Component({
  selector: "bucket-relation",
  templateUrl: "./relation-schema.component.html",
  styleUrls: ["./relation-schema.component.scss"]
})
export class RelationSchemaComponent {
  public buckets: Observable<Bucket[]>;

  constructor(
    @Inject(INPUT_SCHEMA) public schema: RelationSchema,
    private bucketService: BucketService
  ) {
    setTimeout(() => {
      if (!this.schema.relationType) {
        this.schema.relationType = RelationType.OneToOne;
      }
      this.buckets = this.bucketService.getBuckets().pipe(
        tap(buckets => {
          if (!this.schema.bucketId) {
            this.schema.bucketId = buckets[0]._id;
          }
        })
      );
    });
  }
}
