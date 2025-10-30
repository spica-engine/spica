import type {Properties} from "src/services/bucketService";
import type {FieldRegistry} from "src/domain/fields/types";
import {BucketEntryValidator, type ValidationResult} from "./BucketEntryValidator";
import {BucketEntryTransformer} from "./BucketEntryTransformer";

export interface IBucketApiClient {
  createEntry(bucketId: string, data: Record<string, any>): Promise<any>;
}

export interface SubmitResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class BucketEntryService {
  private validator: BucketEntryValidator;
  private transformer: BucketEntryTransformer;

  constructor(
    private fieldRegistry: FieldRegistry,
    private apiClient: IBucketApiClient
  ) {
    this.validator = new BucketEntryValidator(fieldRegistry);
    this.transformer = new BucketEntryTransformer(fieldRegistry);
  }

  validate(
    value: Record<string, any>,
    properties: Properties,
    requiredFields: string[]
  ): ValidationResult {
    return this.validator.validate(value, properties, requiredFields);
  }


  findFirstErrorId(
    errors: Record<string, any>,
    properties: Properties
  ): string | null {
    return this.validator.findFirstErrorId(errors, properties);
  }


  generateInitialValues(properties: Properties): Record<string, any> {
    return this.transformer.generateInitialValues(properties);
  }


  async submitEntry(
    bucketId: string,
    value: Record<string, any>,
    properties: Properties,
    requiredFields: string[]
  ): Promise<SubmitResult> {
    try {

      const normalized = this.transformer.normalizeForSave(value, properties);

      const cleaned = this.transformer.cleanAllValues(normalized, properties, requiredFields);

      const result = await this.apiClient.createEntry(bucketId, cleaned);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create entry"
      };
    }
  }
}

