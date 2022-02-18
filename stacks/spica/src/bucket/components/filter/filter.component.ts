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

  errorMessage;

  currentTabIndex: number = 0;

  mongodbHistory = [];
  expressionHistory = [];

  advancedFilters = [];

  readonly filterOrigins = ["string", "boolean", "object"];

  readonly defaultOperator = "equals";
  selectedOperator = [this.defaultOperator];

  defaultFactory = operator => {
    return value => {
      return {[operator]: value};
    };
  };

  stringContainsFactory = value => {
    return {
      // we should escape special characters
      $regex: value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i"
    };
  };

  dateBetweenFactory(value: string[]) {
    return {
      $gte: `Date(${new Date(value[0]).toISOString()})`,
      $lt: `Date(${new Date(value[1]).toISOString()})`
    };
  }

  operators = {
    string: {
      equals: this.defaultFactory("$eq"),
      not_equal: this.defaultFactory("$ne"),
      contains: this.stringContainsFactory,
      regex: this.defaultFactory("$regex")
    },
    textarea: {
      equals: this.defaultFactory("$eq"),
      not_equal: this.defaultFactory("$ne"),
      contains: this.stringContainsFactory,
      regex: this.defaultFactory("$regex")
    },
    number: {
      equals: this.defaultFactory("$eq"),
      not_equal: this.defaultFactory("$ne"),
      less_than: this.defaultFactory("$lt"),
      greater_than: this.defaultFactory("$gt"),
      less_than_or_equal: this.defaultFactory("$lte"),
      greater_than_or_equal: this.defaultFactory("$gte")
    },
    array: {
      include_one: this.defaultFactory("$in"),
      not_include: this.defaultFactory("$nin"),
      include_all: this.defaultFactory("$all")
    },
    date: {
      between: this.dateBetweenFactory
    }
  };

  get active(): boolean {
    return this.filter && Object.keys(this.filter).length > 0;
  }

  properties: {[key: string]: InputSchema & PropertyOptions} = {};

  property = [];
  value = [];

  typeMappings = new Map<string, string>([["richtext", "textarea"]]);

  constructor(private resolver: InputResolver) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.schema && this.schema) {
      this.fillHistory();
      this.onSchemaChange();
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
        const expressions = {
          $or: []
        };
        for (const [k, v] of Object.entries(this.properties)) {
          if (v.type == "string") {
            const factory = this.defaultFactory(this.stringContainsFactory);
            const expression = factory(this.value[0]);
            expressions.$or.push({
              [k]: expression
            });
          }
        }
        this.filter = expressions.$or.length ? expressions : {};
        break;
      case 1:
        const filters = [];
        for (let i = 0; i < this.selectedOperator.length; i++) {
          const filter = this.createAdvancedFilter(i);
          if (filter) {
            filters.push(filter);
          }
        }

        if (!filters.length) {
          this.filter = {};
          break;
        }

        this.filter = {
          $and: filters
        };

        break;
      case 2:
        try {
          this.filter = JSON.parse(this.value[0] as any);
        } catch (error) {
          this.errorMessage = error;
          setTimeout(() => (this.errorMessage = undefined), 3000);
          break;
        }

        this.addToHistory(this.mongodbHistory, this.value[0] as string);
        this.saveHistoryChanges("mongodb", this.mongodbHistory);
        break;
      case 3:
        this.filter = this.value[0];

        this.addToHistory(this.expressionHistory, this.value[0]);
        this.saveHistoryChanges("expression", this.expressionHistory);
        break;
      default:
        this.filter = {};
        break;
    }

    this.filterChange.emit(this.filter);
  }

  createAdvancedFilter(i) {
    if (!this.property[i]) {
      return;
    }

    const type = this.properties[this.property[i]].type;

    switch (type) {
      case "relation":
        return {
          [`${this.property[this.property[i]]}._id`]:
            this.properties[this.property[i]]["relationType"] == "onetomany"
              ? {$in: this.value[i]}
              : this.value[i]
        };

      default:
        let filterValue = this.value[i];
        if (this.operators[type]) {
          const factory = this.operators[type][this.selectedOperator[i]];
          filterValue = factory(this.value[i]);
        }

        return {[this.property[i]]: filterValue};
    }
  }

  addAdvancedFilter() {
    this.value.push(undefined);
    this.property.push(undefined);
    this.selectedOperator.push(this.defaultOperator);
  }

  removeAdvancedFilter(i) {
    this.value.splice(i, 1);
    this.property.splice(i, 1);
    this.selectedOperator.splice(i, 1);
  }

  fillHistory() {
    this.mongodbHistory = this.getHistory("mongodb");
    this.expressionHistory = this.getHistory("expression");
  }

  resetHistories() {
    this.mongodbHistory = [];
    this.expressionHistory = [];
  }

  saveHistoryChanges(filterType: "mongodb" | "expression", history: string[]) {
    localStorage.setItem(
      `bucket_${this.schema._id}_${filterType}_filter_history`,
      JSON.stringify(history)
    );
  }

  addToHistory(history: string[], newItem: string) {
    if (history.length == 10) {
      history.pop();
    }
    history.unshift(newItem);
  }

  getHistory(filterType: "mongodb" | "expression"): string[] {
    const history =
      localStorage.getItem(`bucket_${this.schema._id}_${filterType}_filter_history`) || "[]";

    return JSON.parse(history);
  }

  onSchemaChange() {
    this.properties = {};
    this.resetInputs();
  }

  resetInputs() {
    this.property = [undefined];
    this.value = [undefined];
    this.filter = undefined;
    this.selectedOperator = [this.defaultOperator];
    this.filter = undefined;
  }

  onPropertyChange(i = 0) {
    this.value[i] = undefined;
    this.selectedOperator[i] = this.defaultOperator;

    const operators = this.operators[this.properties[this.property[i]].type];
    if (operators) {
      const first = Object.keys(operators)[0];
      this.selectedOperator[i] = first;
    }
  }
}
