import type { BucketPropertyType, CellTypeConfig } from "./types";
import {
  StringCell,
  NumberCell,
  DateCell,
  DefaultCell,
  MultipleSelectionCell,
  ColorCell,
  StorageCell,
  TextareaCell,
  BooleanCell,
  ArrayCell,
  ObjectCell,
  LocationCell,
  JsonCell,
  RelationCell,
} from "./cells";


class CellRegistry {
  private readonly registry: Map<BucketPropertyType, CellTypeConfig>;
  private readonly defaultConfig: CellTypeConfig;

  constructor() {
    this.registry = new Map();
    
    this.defaultConfig = {
      component: DefaultCell,
    };

    this.registerDefaults();
  }

  private registerDefaults() {
    this.register("string", {
      component: StringCell,
      defaultValue: "",
    });

    this.register("number", {
      component: NumberCell,
      defaultValue: 0,
    });

    this.register("date", {
      component: DateCell,
      defaultValue: null,
    });

    this.register("multiselect", {
      component: MultipleSelectionCell,
      defaultValue: [],
    });

    this.register("boolean", {
      component: BooleanCell,
      defaultValue: false,
    });

    this.register("color", {
      component: ColorCell,
      defaultValue: "#000000",
    });

    this.register("storage", {
      component: StorageCell,
      defaultValue: null,
    });

    this.register("textarea", {
      component: TextareaCell,
      defaultValue: "",
    });

    this.register("array", {
      component: ArrayCell,
      defaultValue: [],
    });

    this.register("object", {
      component: ObjectCell,
      defaultValue: {},
    });

    this.register("location", {
      component: LocationCell,
      defaultValue: null,
    });

    this.register("json", {
      component: JsonCell,
      defaultValue: {},
    });

    this.register("relation", {
      component: RelationCell,
      defaultValue: null,
    });
  }

  public register(type: BucketPropertyType | string, config: CellTypeConfig) {
    this.registry.set(type as BucketPropertyType, config);
  }

  public get(type: BucketPropertyType | string): CellTypeConfig {
    return this.registry.get(type as BucketPropertyType) || this.defaultConfig;
  }

  public has(type: BucketPropertyType | string): boolean {
    return this.registry.has(type as BucketPropertyType);
  }

  public getRegisteredTypes(): BucketPropertyType[] {
    return Array.from(this.registry.keys());
  }
}

export const cellRegistry = new CellRegistry();

export { CellRegistry };

