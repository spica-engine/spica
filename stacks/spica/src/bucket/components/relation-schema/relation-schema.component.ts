import {Component, Inject, OnInit} from "@angular/core";
import {INPUT_SCHEMA} from "@spica-client/common";
import {Observable} from "rxjs";
import {BucketService} from "../../services/bucket.service";
import {Bucket} from "../../interfaces/bucket";
import {RelationSchema, RelationType} from "../relation";
import {tap} from "rxjs/operators";

import * as pluralize from "pluralize";

import {AddFieldModalComponent} from "@spica-client/bucket/pages/add-field-modal/add-field-modal.component";

@Component({
  selector: "bucket-relation",
  templateUrl: "./relation-schema.component.html",
  styleUrls: ["./relation-schema.component.scss"]
})
export class RelationSchemaComponent implements OnInit {
  public buckets: Observable<Bucket[]>;
  field: string;
  parentSchema: any;
  propertyKey: string = "";
  propertyKv: any;
  matchedRelation: any;

  constructor(
    @Inject(INPUT_SCHEMA) public schema: RelationSchema,
    private bucketService: BucketService,
    @Inject(AddFieldModalComponent) public data: AddFieldModalComponent
  ) {
    setTimeout(() => {
      if (!this.schema.relationType && !pluralize.isPlural(this.propertyKey)) {
        this.schema.relationType = RelationType.OneToOne;
      } else {
        this.schema.relationType = RelationType.OneToMany;
      }

      this.buckets = this.bucketService.getBuckets().pipe(
        tap(buckets => {
          if (!this.schema.bucketId) {
            this.matchedRelation = buckets
              .map((bucket, index) =>
                bucket.title.toLowerCase() === pluralize.plural(this.propertyKey) ||
                bucket.title.toLowerCase() === this.propertyKey
                  ? index
                  : undefined
              )
              .filter(index => index !== undefined);

            if (this.matchedRelation.length > 0) {
              this.schema.bucketId = buckets[this.matchedRelation]._id;
            } else {
              this.schema.bucketId = buckets[0]._id;
            }
          }
        })
      );
    });
  }
  ngOnInit(): void {
    this.parentSchema = this.data.parentSchema;
    if (this.data.propertyKey) {
      this.propertyKey = this.data.propertyKey;
      this.propertyKv = this.parentSchema.properties[this.propertyKey];
      this.field = this.propertyKv.type;
    }
  }
}
