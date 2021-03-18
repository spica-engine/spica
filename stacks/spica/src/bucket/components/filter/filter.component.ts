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

  selectedOperator = "";

  operators = {
    string: {
      equals: "$eq",
      not_equal: "$ne",
      regex: "$regex"
    },
    textarea: {
      equals: "$eq",
      not_equal: "$ne",
      regex: "$regex"
    },
    number: {
      equals: "$eq",
      not_equal: "$ne",
      less_than: "$lt",
      greater_than: "$gt",
      less_than_or_equal: "$lte",
      greater_than_or_equal: "$gte"
    },
    array: {
      include_one: "$in",
      not_include: "$nin",
      include_all: "$all"
    }
    //@TODO: object and location that we may need to add
  };

  get active(): boolean {
    return this.filter && Object.keys(this.filter).length > 0;
  }

  properties: {[key: string]: InputSchema & PropertyOptions} = {};

  property: string;
  value: string | boolean | number | unknown[];

  typeMappings = new Map<string, string>([["richtext", "textarea"]]);

  constructor(private resolver: InputResolver) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.schema && this.schema) {
      this.property = undefined;
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
    const type = this.properties[this.property].type;

    switch (type) {
      case "relation":
        this.filter = {
          [`${this.property}._id`]:
            this.properties[this.property]["relationType"] == "onetomany"
              ? {$in: this.value}
              : this.value
        };
        break;

      case "date":
        this.filter = {
          [this.property]: {
            $gte: `Date(${new Date(this.value[0]).toISOString()})`,
            $lt: `Date(${new Date(this.value[1]).toISOString()})`
          }
        };
        break;

      default:
        if (this.selectedOperator) {
          this.filter = {[this.property]: {[this.selectedOperator]: this.value}};
        } else {
          this.filter = {[this.property]: this.value};
        }
        break;
    }

    console.log(this.filter);
    this.filterChange.emit(this.filter);
  }

  clear() {
    this.property = undefined;
    this.value = undefined;
    this.selectedOperator = undefined;

    this.filter = undefined;
    this.filterChange.emit(this.filter);
  }
}
