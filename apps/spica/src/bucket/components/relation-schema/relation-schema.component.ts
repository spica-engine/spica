import {Component, Inject, OnInit} from "@angular/core";
import {INPUT_SCHEMA} from "@spica-client/common";
import {Observable} from "rxjs";
import {BucketService} from "../../services/bucket.service";
import {Bucket} from "../../interfaces/bucket";
import {RelationSchema, RelationType} from "../relation";
import {tap} from "rxjs/operators";
import * as pluralize from "pluralize";

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
    private bucketService: BucketService
  ) {
    setTimeout(() => {
      if (!this.schema.relationType) {
        this.setRelationType();
      }

      this.buckets = this.bucketService.getBuckets().pipe(
        tap(buckets => {
          if (!this.schema.bucketId) {
            this.setBucketId(buckets);
          }
        })
      );
    });
  }

  setRelationType() {
    if (!this.schema.title) {
      return;
    }

    this.schema.relationType = pluralize.isPlural(this.schema.title)
      ? RelationType.OneToMany
      : RelationType.OneToOne;
  }

  setBucketId(buckets) {
    const matchedRelationIndex = buckets.findIndex(
      bucket =>
        bucket.title.toLowerCase() === this.pluralPropertyKey ||
        bucket.title.toLowerCase() === this.singularPropertyKey
    );

    if (matchedRelationIndex != -1) {
      this.schema.bucketId = buckets[matchedRelationIndex]._id;
    } else {
      this.schema.bucketId = buckets[0]._id;
    }
  }

  ngOnInit(): void {
    if (this.schema.title) {
      this.singularPropertyKey = pluralize.singular(this.schema.title);
      this.pluralPropertyKey = pluralize.plural(this.schema.title);
    }
  }
}
