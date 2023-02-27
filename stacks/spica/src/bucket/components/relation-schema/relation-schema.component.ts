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
  singularPropertyKey: string = "";
  pluralPropertyKey: string = "";

  constructor(
    @Inject(INPUT_SCHEMA) public schema: RelationSchema,
    private bucketService: BucketService,
    @Inject(AddFieldModalComponent) public data: AddFieldModalComponent,
  ) {
    setTimeout(() => {
      if (!this.schema.relationType && !pluralize.isPlural(this.data.propertyKey)) {
        this.schema.relationType = RelationType.OneToOne;
      } else {
        this.schema.relationType = RelationType.OneToMany;
      }
      this.buckets = this.bucketService.getBuckets().pipe(
        tap(buckets => {
          if (!this.schema.bucketId) {
            let matchedRelation: number[]= buckets
              .map((bucket, index) =>
                bucket.title.toLowerCase() === this.pluralPropertyKey ||
                bucket.title.toLowerCase() === this.singularPropertyKey
                  ? index
                  : undefined
              )
              .filter(index => index !== undefined);

            if (matchedRelation.length > 0) {
              this.schema.bucketId = buckets[matchedRelation]._id;
            } else {
              this.schema.bucketId = buckets[0]._id;
            }
          }
        })
      );
    });
  }
  ngOnInit(): void {
    if (this.data.propertyKey) {
      this.singularPropertyKey = pluralize.singular(this.data.propertyKey);
      this.pluralPropertyKey = pluralize.plural(this.data.propertyKey);
    }
  }
}
