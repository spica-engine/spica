import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from "@angular/core";
import {InputResolver, InputSchema} from "@spica-client/common";
import {FilterSchema} from "../../interfaces/identity";

@Component({
  selector: "filter",
  templateUrl: "./filter.component.html",
  styleUrls: ["./filter.component.scss"]
})
export class FilterComponent implements OnChanges {
  @Input() schema: FilterSchema;
  @Input() filter: any;
  @Output() filterChange = new EventEmitter();

  readonly filterOrigins = ["string", "boolean", "object"];

  get active(): boolean {
    return this.filter && Object.keys(this.filter).length > 0;
  }

  properties: {[key: string]: InputSchema} = {};

  property: string;
  value: string | boolean | number | any[];

  typeMappings = new Map<string, string>([["richtext", "textarea"]]);

  constructor(private resolver: InputResolver) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.schema && this.schema) {
      this.property = undefined;
      for (const [key, value] of Object.entries(this.schema.properties)) {
        if (this.resolver.getOriginByType(value.type)) {
          this.properties[key] = value;
          if (this.typeMappings.has(value.type)) {
            this.properties[key] = {
              ...value,
              type: this.typeMappings.get(value.type)
            };
          }
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
