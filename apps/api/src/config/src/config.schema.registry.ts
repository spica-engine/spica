import {BadRequestException, Injectable} from "@nestjs/common";
import {Schema, Validator} from "@spica-server/core/schema";

@Injectable()
export class ConfigSchemaRegistry {
  private readonly schemas = new Map<string, object>();
  private cachedCompositeSchema: object | null = null;

  constructor(private readonly validator: Validator) {}

  register(module: string, optionsSchema: object): void {
    this.schemas.set(module, optionsSchema);
    this.cachedCompositeSchema = null;
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
        anyOf: branches.length > 0 ? branches : [{not: {}}]
      };
    }
    return this.cachedCompositeSchema;
  }

  async validate(data: unknown): Promise<void> {
    const schema = this.buildCompositeSchema();
    const validatorMixin = Schema.validate(schema);
    const pipe: any = new validatorMixin(this.validator);
    return pipe.transform(data);
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
