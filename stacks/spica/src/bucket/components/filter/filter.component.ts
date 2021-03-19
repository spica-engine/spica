import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from "@angular/core";
import {InputResolver, InputSchema} from "@spica-client/common";
import {Bucket, PropertyOptions} from "../../interfaces/bucket";

@Component({
  selector: "bucket-filter",
  templateUrl: "./filter.component.html",
  styleUrls: ["./filter.component.scss"]
})
export class FilterComponent implements OnInit, OnChanges, OnDestroy {
  @Input() schema: Bucket;
  @Input() filter: any;
  @Output() filterChange = new EventEmitter();

  currentTabIndex: number;

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
    switch (this.currentTabIndex) {
      case 0:
        this.filter = this.createBasicFilter();
        break;
      case 1:
        try {
          this.filter = JSON.parse(this.value as any);
        } catch (error) {
          console.log(error);
        }
        break;
      case 2:
        console.log(typeof this.value);
        this.filter = this.value;
        break;
      default:
        this.filter = {};
        break;
    }

    this.filterChange.emit(this.filter);
  }

  createBasicFilter() {
    const type = this.properties[this.property].type;

    switch (type) {
      case "relation":
        return {
          [`${this.property}._id`]:
            this.properties[this.property]["relationType"] == "onetomany"
              ? {$in: this.value}
              : this.value
        };

      case "date":
        return {
          [this.property]: {
            $gte: `Date(${new Date(this.value[0]).toISOString()})`,
            $lt: `Date(${new Date(this.value[1]).toISOString()})`
          }
        };

      default:
        if (this.selectedOperator) {
          return {[this.property]: {[this.selectedOperator]: this.value}};
        }
        return {[this.property]: this.value};
    }
  }

  reset() {
    this.property = undefined;
    this.value = undefined;
    this.selectedOperator = undefined;
    this.filter = undefined;
  }

  onPropertyChange() {
    this.value = undefined;
    this.filter = undefined;
    this.selectedOperator = undefined;
  }
}
