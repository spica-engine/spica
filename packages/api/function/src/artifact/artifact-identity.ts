import {Inject, Injectable} from "@nestjs/common";
import {Function, Options, FUNCTION_OPTIONS} from "@spica-server/interface-function";
import {FunctionArtifactInputs} from "@spica-server/interface-function-asset-storage";
import {hashBuffer} from "../asset-keys.js";
import {FunctionPreparationService} from "../function-preparation.service.js";
import {artifactKey, platformId} from "./artifact-key.js";

export interface ArtifactDescriptor {
  inputs: FunctionArtifactInputs;
  platform: string;
  key: string;
}

@Injectable()
export class ArtifactIdentity {
  private readonly platform = platformId();

  constructor(
    private readonly preparationService: FunctionPreparationService,
    @Inject(FUNCTION_OPTIONS) private readonly options: Options
  ) {}

  async of(fn: Function): Promise<ArtifactDescriptor> {
    const [index, packageJson, lockfile] = await Promise.all(
      [this.preparationService.indexFilename(fn), "package.json", "package-lock.json"].map(
        filename => this.preparationService.readFileBuffer(fn, filename)
      )
    );
    const inputs: FunctionArtifactInputs = {
      index: index ? hashBuffer(index) : null,
      packageJson: packageJson ? hashBuffer(packageJson) : null,
      lockfile: lockfile ? hashBuffer(lockfile) : null,
      builder: this.options.builder ?? "legacy"
    };
    return {inputs, platform: this.platform, key: artifactKey(fn.name, inputs, this.platform)};
  }
}
