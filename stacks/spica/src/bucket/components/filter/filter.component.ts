import {AfterViewInit, Component, EventEmitter, Input, Output, ViewChild} from "@angular/core";
import {MatSelect} from "@angular/material/select";
import {InputSchema} from "@spica-client/common/input";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";
import {Bucket, PropertyOptions} from "../../interfaces/bucket";

@Component({
  selector: "bucket-filter",
  templateUrl: "./filter.component.html",
  styleUrls: ["./filter.component.scss"]
})
export class FilterComponent implements AfterViewInit {
  @Input("meta") $meta: Observable<Bucket>;
  @Input() filter: any;
  @Output() filterChange = new EventEmitter();

  @ViewChild("target", {static: true}) target: MatSelect;

  filterQuery: any;

  properties: {[key: string]: InputSchema & PropertyOptions} = {};

  value: any;

  readonly filterableTypes = {
    string: {origin: "string"},
    textarea: {origin: "string"},
    richtext: {origin: "string"},
    number: {origin: "number"},
    boolean: {origin: "boolean"}
  };

  readonly queries = {
    string: '{"_target": {"$regex": "(?i)_value"}}',
    number: '{"_target": {"$eq": _value}}',
    boolean: '{"_target": {"$eq": _value}}'
  };

  ngAfterViewInit() {
    this.$meta
      .pipe(
        map(meta => {
          if (meta) {
            for (const [key, value] of Object.entries(meta.properties)) {
              if (Object.keys(this.filterableTypes).includes(value.type)) {
                this.properties[key] = value;
              }
            }
          }
          return meta;
        })
      )
      .subscribe();
  }

  applyFilter(target: any) {
    const query = this.queries[this.filterableTypes[this.properties[target].type].origin];
    this.filter = query.replace("_target", target).replace("_value", this.value);
    this.filterChange.emit(this.filter);
  }

  clearFilter() {
    this.target.value = undefined;
    this.value = undefined;
    this.filter = undefined;
    this.filterChange.emit(this.filter);
  }
}
