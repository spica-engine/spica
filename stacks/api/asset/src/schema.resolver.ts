import {Injectable} from "@nestjs/common";
import {Validator} from "@spica-server/core/schema";
import {Asset, Config} from "@spica-server/interface/asset";
import {ObjectId} from "bson";
import {of} from "rxjs";
import {AssetService} from "./service";

@Injectable()
export class AssetInstallSchemaResolver {
  private assets: Asset[] = [];

  constructor(private service: AssetService) {
    this.service.watch().subscribe(assets => {
      this.assets = assets;
    });
  }

  resolve(uri) {
    const asset = this.assets.find(asset => asset._id == uri);

    if (!asset) {
      return of({});
    }

    const compiledConfigs = asset.configs.map(config => this.compileConfig(config));

    const requiredConfigs = compiledConfigs.filter(
      config => !Object.keys(config.properties.value).includes("default")
    );

    const schema: any = {
      $id: `http://spica.internal/asset/${uri}/install`,
      type: "object",
      required: ["configs"],
      properties: {
        configs: {
          type: "array",
          const: []
        }
      },
      additionalProperties: false
    };

    if (compiledConfigs.length) {
      delete schema.properties.configs.const;
      schema.properties.configs.items = {
        anyOf: compiledConfigs
      };
    }

    if (requiredConfigs.length) {
      schema.properties.configs.contains = {
        allOf: requiredConfigs
      };
    }

    return of(schema);
  }

  private compileConfig(config: Config) {
    const schema: any = {
      type: "object",
      additionalProperties: false,
      required: [],
      properties: {}
    };

    // value validation
    schema.properties.value = {
      type: config.type
    };
    if (Object.keys(config).includes("value")) {
      schema.properties.value.default = config.value;
    } else {
      schema.required.push("value");
    }

    // remove unnecessaries and already configureds
    delete config.value;
    delete config.type;
    delete config.title;

    // value target validation
    for (const [property, value] of Object.entries(config)) {
      schema.required.push(property);
      schema.properties[property] = {
        const: value
      };
    }

    return schema;
  }
}

export function provideAssetInstallSchemaResolver(service: AssetService, validator: Validator) {
  // const resolver = new AssetInstallSchemaResolver(service);
  // validator.registerUriResolver(uri => resolver.resolve(uri));
  // return resolver;
}
