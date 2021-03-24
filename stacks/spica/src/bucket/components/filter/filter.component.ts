import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from "@angular/core";
import {InputResolver, InputSchema} from "@spica-client/common";
import {Bucket, PropertyOptions} from "../../interfaces/bucket";

@Component({
  selector: "bucket-filter",
  templateUrl: "./filter.component.html",
  styleUrls: ["./filter.component.scss"]
})
export class FilterComponent implements OnChanges {
  @Input() schema: Bucket;
  @Input() filter: any;
  @Output() filterChange = new EventEmitter();

  readonly filterOrigins = ["string", "boolean", "object"];

  get active(): boolean {
    return this.filter && Object.keys(this.filter).length > 0;
  }

  properties: {[key: string]: InputSchema & PropertyOptions} = {};

  property: string;
  value: string | boolean | number | unknown[];

  typeMappings = new Map<string, string>([["richtext", "textarea"]]);

  constructor(private resolver: InputResolver) {}

  resetPreviousValues() {
    this.properties = {};
    this.property = undefined;
    this.value = undefined;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.schema && this.schema) {
      this.resetPreviousValues();
      for (const [key, value] of Object.entries(this.schema.properties)) {
        if (this.resolver.getOriginByType(value.type)) {
          this.properties[key] = value;
          if (this.typeMappings.has(value.type)) {
            this.properties[key] = {...value, type: this.typeMappings.get(value.type)};
          }
        }
      }
    }
  }

  apply() {
    if (this.properties[this.property].type == "relation") {
      this.filter = {
        [`${this.property}._id`]:
          this.properties[this.property]["relationType"] == "onetomany"
            ? {$in: this.value}
            : this.value
      };
    } else if (this.properties[this.property].type == "date") {
      this.filter = {
        [this.property]: {
          $gte: `Date(${new Date(this.value[0]).toISOString()})`,
          $lt: `Date(${new Date(this.value[1]).toISOString()})`
        }
      };
    } else {
      const origin = this.resolver.getOriginByType(this.properties[this.property].type);
      this.filter = {[this.property]: origin == "string" ? {$regex: this.value} : this.value};
    }
    this.filterChange.emit(this.filter);
  }

  clear() {
    this.value = undefined;
    this.filter = undefined;
    this.filterChange.emit(this.filter);
  }
}
