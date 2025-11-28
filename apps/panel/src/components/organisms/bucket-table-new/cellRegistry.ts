import type { BucketPropertyType, CellTypeConfig } from "./types";
import {
  StringCell,
  StringCellKeyboardHandler,
  NumberCell,
  NumberCellKeyboardHandler,
  TextareaCell,
  TextareaCellKeyboardHandler,
  DateCell,
  DateCellKeyboardHandler,
  RelationCell,
  RelationCellKeyboardHandler,
  BooleanCell,
  BooleanCellKeyboardHandler,
  DefaultCell,
  DefaultCellKeyboardHandler,
} from "./cells";

/**
 * Cell Registry - Central configuration for all cell types
 * 
 * This is the heart of the extensible system. To add a new cell type:
 * 1. Create a new cell component in the cells/ folder
 * 2. Create its keyboard handler
 * 3. Register it here
 * 
 * Each cell type is completely independent and self-contained.
 */
class CellRegistry {
  private readonly registry: Map<BucketPropertyType, CellTypeConfig>;
  private readonly defaultConfig: CellTypeConfig;

  constructor() {
    this.registry = new Map();
    
    // Default fallback for unknown types
    this.defaultConfig = {
      component: DefaultCell,
      keyboardHandler: DefaultCellKeyboardHandler,
    };

    // Register all known cell types
    this.registerDefaults();
  }

  private registerDefaults() {
    this.register("string", {
      component: StringCell,
      keyboardHandler: StringCellKeyboardHandler,
      defaultValue: "",
    });

    this.register("textarea", {
      component: TextareaCell,
      keyboardHandler: TextareaCellKeyboardHandler,
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

    this.register("relation", {
      component: RelationCell,
      keyboardHandler: RelationCellKeyboardHandler,
      defaultValue: null,
    });

    this.register("boolean", {
      component: BooleanCell,
      keyboardHandler: BooleanCellKeyboardHandler,
      defaultValue: false,
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
  }

  /**
   * Register a new cell type
   * This allows external modules to register custom cell types
   */
  public register(type: BucketPropertyType | string, config: CellTypeConfig) {
    this.registry.set(type as BucketPropertyType, config);
  }

  /**
   * Get configuration for a cell type
   */
  public get(type: BucketPropertyType | string): CellTypeConfig {
    return this.registry.get(type as BucketPropertyType) || this.defaultConfig;
  }

  /**
   * Check if a cell type is registered
   */
  public has(type: BucketPropertyType | string): boolean {
    return this.registry.has(type as BucketPropertyType);
  }

  /**
   * Get all registered types
   */
  public getRegisteredTypes(): BucketPropertyType[] {
    return Array.from(this.registry.keys());
  }
}

// Export singleton instance
export const cellRegistry = new CellRegistry();

// Export the class for testing or creating custom instances
export { CellRegistry };

