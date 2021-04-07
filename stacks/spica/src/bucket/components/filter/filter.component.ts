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
export class FilterComponent implements OnChanges {
  @Input() schema: Bucket;
  @Input() filter: any;
  @Output() filterChange = new EventEmitter();

  errorMessage;

  currentTabIndex: number = 0;

  mongodbHistory = [];
  expressionHistory = [];

  readonly filterOrigins = ["string", "boolean", "object"];

  selectedOperator = "";

  containsBuilder = (value: string) => {
    return {
      // we should escape special characters
      $regex: value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i"
    };
  };

  operators = {
    string: {
      equals: this.createValueBuilder("$eq"),
      not_equal: this.createValueBuilder("$neq"),
      contains: this.createValueBuilder("$regex", this.containsBuilder),
      regex: this.createValueBuilder("$regex")
    },
    textarea: {
      equals: this.createValueBuilder("$eq"),
      not_equal: this.createValueBuilder("$neq"),
      contains: this.createValueBuilder("$regex", this.containsBuilder),
      regex: this.createValueBuilder("$regex")
    },
    number: {
      equals: this.createValueBuilder("$eq"),
      not_equal: this.createValueBuilder("$ne"),
      less_than: this.createValueBuilder("$lt"),
      greater_than: this.createValueBuilder("$gt"),
      less_than_or_equal: this.createValueBuilder("$lte"),
      greater_than_or_equal: this.createValueBuilder("$gte")
    },
    array: {
      include_one: this.createValueBuilder("$in"),
      not_include: this.createValueBuilder("$nin"),
      include_all: this.createValueBuilder("$all")
    }
  };

  get active(): boolean {
    return this.filter && Object.keys(this.filter).length > 0;
  }

  properties: {[key: string]: InputSchema & PropertyOptions} = {};

  property: string;
  value: string | boolean | number | unknown[];

  typeMappings = new Map<string, string>([["richtext", "textarea"]]);

  constructor(private resolver: InputResolver) {}

  createValueBuilder(
    operator: string,
    builder = value => {
      return {[operator]: value};
    }
  ) {
    return value => builder(value);
  }

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
        this.filter = this.createBasicFilter();
        break;
      case 1:
        try {
          this.filter = JSON.parse(this.value as any);
        } catch (error) {
          this.errorMessage = error;
          setTimeout(() => (this.errorMessage = undefined), 3000);
          break;
        }

        this.addToHistory(this.mongodbHistory, this.value as string);
        this.saveHistoryChanges("mongodb", this.mongodbHistory);
        break;
      case 2:
        this.filter = this.value;

        this.addToHistory(this.expressionHistory, this.value as string);
        this.saveHistoryChanges("expression", this.expressionHistory);
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
          const valueBuilder = this.operators[type][this.selectedOperator];
          const preparedValue = valueBuilder(this.value);

          return {[this.property]: preparedValue};
        }
        return {[this.property]: this.value};
    }
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
    this.property = undefined;
    this.onPropertyChange();
  }

  onPropertyChange() {
    this.value = undefined;
    this.filter = undefined;
    this.selectedOperator = undefined;
  }
}
