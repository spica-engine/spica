import type { BucketPropertyType, CellTypeConfig } from "./types";
import {
  StringCell,
  StringCellKeyboardHandler,
  NumberCell,
  NumberCellKeyboardHandler,
  DateCell,
  DateCellKeyboardHandler,
  DefaultCell,
  DefaultCellKeyboardHandler,
  MultipleSelectionCell,
  MultipleSelectionCellKeyboardHandler,
  ColorCell,
  ColorCellKeyboardHandler,
  StorageCell,
  StorageCellKeyboardHandler,
} from "./cells";


class CellRegistry {
  private readonly registry: Map<BucketPropertyType, CellTypeConfig>;
  private readonly defaultConfig: CellTypeConfig;

  constructor() {
    this.registry = new Map();
    
    this.defaultConfig = {
      component: DefaultCell,
      keyboardHandler: DefaultCellKeyboardHandler,
    };

    this.registerDefaults();
  }

  private registerDefaults() {
    this.register("string", {
      component: StringCell,
      keyboardHandler: StringCellKeyboardHandler,
      defaultValue: "",
    });

    this.register("number", {
      component: NumberCell,
      keyboardHandler: NumberCellKeyboardHandler,
      defaultValue: 0,
    });

    this.register("date", {
      component: DateCell,
      keyboardHandler: DateCellKeyboardHandler,
      defaultValue: null,
    });

    this.register("multiselect", {
      component: MultipleSelectionCell,
      keyboardHandler: MultipleSelectionCellKeyboardHandler,
      defaultValue: [],
    });

    this.register("array", {
      component: DefaultCell,
      keyboardHandler: DefaultCellKeyboardHandler,
      defaultValue: [],
    });

    this.register("object", {
      component: DefaultCell,
      keyboardHandler: DefaultCellKeyboardHandler,
      defaultValue: {},
    });

    this.register("color", {
      component: ColorCell,
      keyboardHandler: ColorCellKeyboardHandler,
      defaultValue: "#000000",
    });

    this.register("storage", {
      component: StorageCell,
      keyboardHandler: StorageCellKeyboardHandler,
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

