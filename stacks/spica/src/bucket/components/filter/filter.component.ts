import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from "@angular/core";
import {InputResolver, InputSchema} from "@spica-client/common";
import {Bucket, PropertyOptions} from "../../interfaces/bucket";

@Component({
  selector: "bucket-filter",
  templateUrl: "./filter.component.html",
  styleUrls: ["./filter.component.scss"]
})
export class FilterComponent implements OnChanges {
  @Input() meta: Bucket;
  @Input() filter: any;
  @Output() filterChange = new EventEmitter();

  readonly filterOrigins = ["string", "boolean", "object"];

  get active(): boolean {
    return this.filter && Object.keys(this.filter).length > 0;
  }

  properties: {[key: string]: InputSchema & PropertyOptions} = {};

  property: string;
  value: string | boolean | number;

  constructor(private resolver: InputResolver) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.meta && this.meta) {
      for (const [key, value] of Object.entries(this.meta.properties)) {
        if (this.resolver.getOriginByType(value.type)) {
          this.properties[key] = value;
          this.properties[key].type =
            this.properties[key].type == "richtext" ? "textarea" : this.properties[key].type;
        }
      }
    }
  }

  apply() {
    const origin = this.resolver.getOriginByType(this.properties[this.property].type);
    this.filter = {[this.property]: origin == "string" ? {$regex: this.value} : this.value};
    this.filterChange.emit(this.filter);
  }

  clear() {
    this.value = undefined;
    this.filter = undefined;
    this.filterChange.emit(this.filter);
  }
}
