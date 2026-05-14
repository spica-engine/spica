import {BadRequestException, Injectable} from "@nestjs/common";
import {Validator} from "@spica-server/core-schema";
import {BaseConfig} from "@spica-server/interface-config";
import {JSONSchema7} from "json-schema";

const COMPOSITE_SCHEMA_ID = "http://spica.internal/config/composite";

@Injectable()
export class ConfigSchemaRegistry {
  private readonly schemas = new Map<string, object>();
  private cachedCompositeSchema: object | null = null;

  constructor(private readonly validator: Validator) {}

  register(module: string, optionsSchema: JSONSchema7): void {
    this.schemas.set(module, optionsSchema);
    this.cachedCompositeSchema = null;
    this.validator.removeSchema(COMPOSITE_SCHEMA_ID);
  }

  hasModule(module: string): boolean {
    return this.schemas.has(module);
  }

  getModuleNames(): string[] {
    return Array.from(this.schemas.keys());
  }

  buildCompositeSchema(): object {
    if (!this.cachedCompositeSchema) {
      const branches = Array.from(this.schemas.entries()).map(([moduleName, optionsSchema]) => ({
        type: "object",
        required: ["module", "options"],
        properties: {
          module: {const: moduleName},
          options: optionsSchema
        },
        additionalProperties: false
      }));

      this.cachedCompositeSchema = {
        $id: COMPOSITE_SCHEMA_ID,
        anyOf: branches.length > 0 ? branches : [{not: {}}]
      };
    }
    return this.cachedCompositeSchema;
  }

  getSchemas(): Record<string, object> {
    const result: Record<string, object> = {};
    for (const [moduleName, optionsSchema] of this.schemas.entries()) {
      result[moduleName] = optionsSchema;
    }
    return result;
  }

  async validate(data: BaseConfig<any>): Promise<void> {
    const schema = this.buildCompositeSchema();
    await this.validator.validate(schema, data).catch(error => {
      throw new BadRequestException(
        error.errors ? error.errors.map((e: any) => e.message).join("\n") : error.message
      );
    });
  }

  validateModule(module: string): void {
    if (!this.hasModule(module)) {
      const allowed = this.getModuleNames().join(", ");
      throw new BadRequestException(
        `Module '${module}' is not registered. Registered modules: ${allowed}`
      );
    }
  }
}
