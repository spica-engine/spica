import {graphqlHTTP} from "express-graphql";
import {HttpAdapterHost} from "@nestjs/core";
import {Injectable, UnauthorizedException} from "@nestjs/common";
import {BucketDataService} from "../bucket-data.service";
import {ObjectID, ObjectId} from "@spica-server/database";
import {BucketService, Bucket, BucketDocument} from "@spica-server/bucket/services";
import {GraphQLScalarType, GraphQLSchema} from "graphql";

import {makeExecutableSchema, mergeTypeDefs, mergeResolvers} from "graphql-tools";
import {hasTranslatedProperties, findLocale, buildI18nAggregation, Locale} from "../locale";
import {buildRelationAggregation} from "../utility";
import {GuardService} from "@spica-server/passport";

enum Action {
  Query = "query",
  Mutation = "mutation"
}

interface FindResponse {
  meta: {total: number};
  entries: BucketDocument[];
}

@Injectable()
export class GraphqlEnpointHandler {
  schema: GraphQLSchema;

  buckets: Bucket[] = [];

  extraInterfaces = "";

  constructor(
    private adapterHost: HttpAdapterHost,
    private bs: BucketService,
    private bds: BucketDataService,
    private guardService: GuardService
  ) {
    let app = this.adapterHost.httpAdapter.getInstance();

    this.bs.watchCollection(true).subscribe(buckets => {
      this.buckets = buckets;

      //graphql needs a default schema that includes one type and resolver at least
      let typeDefs = [
        `type Query{
          spica: String
        }`
      ];

      let resolvers = [];
      resolvers.push({
        Query: {
          spica: () => "Spica"
        }
      });

      if (buckets.length) {
        let defaultTypes = `
          scalar Date

          scalar JSON

          scalar ObjectID
          
          type Meta{
            total: Int
          }

          type Location{
            latitude: Float
            longitude: Float
          }

          input LocationInput{
            latitude: Float
            longitude: Float
          }
      `;

        let dateScalar = new GraphQLScalarType({
          name: "Date",
          description: "JavaScript Date object. Value will be passed to Date constructor.",
          parseValue(value) {
            // value from client
            return new Date(value);
          },
          serialize(value) {
            // value from server
            return value.toString();
          },
          parseLiteral(ast) {
            let value = ast["value"];
            if (new Date(value) instanceof Date && !isNaN(new Date(value).getTime())) {
              return new Date(value);
            } else {
              return null;
            }
          }
        });

        let objectIdScalar = new GraphQLScalarType({
          name: "ObjectID",
          description:
            "BSON ObjectId type. Can be a 24 byte hex string, 12 byte binary string or a Number.",
          parseValue(value) {
            return new ObjectID(value);
          },
          serialize(value) {
            return value.toString();
          },
          parseLiteral(ast) {
            let value = ast["value"];
            if (ObjectID.isValid(value)) {
              return new ObjectID(value);
            } else {
              return null;
            }
          }
        });

        let JSONScalar = new GraphQLScalarType({
          name: "JSON",
          description: "JavaScript Object Notation."
        });

        typeDefs = buckets.map(bucket => this.createSchema(bucket));
        typeDefs.push(defaultTypes);

        resolvers = buckets.map(bucket => this.createResolver(bucket));
        resolvers.push({
          Date: dateScalar,
          ObjectID: objectIdScalar,
          JSON: JSONScalar
        });
      }

      this.schema = makeExecutableSchema({
        typeDefs: mergeTypeDefs(typeDefs),
        resolvers: mergeResolvers(resolvers)
      });
    });

    app.use(
      "/graphql",
      graphqlHTTP(() => {
        return {
          schema: this.schema,
          graphiql: true
        };
      })
    );
  }

  createSchema(bucket: any) {
    this.extraInterfaces = "";
    let name = this.getBucketName(bucket._id);
    let schema = `

      type ${name}FindResponse{
        meta: Meta
        entries: [${name}Entry]
      }

      type ${name}Entry{
        _id: ObjectID
        ${this.createProperties(bucket, Action.Query)}
      }

      type Query{
        ${name}Find(limit: Int, skip: Int, sort: JSON ,language: String, filter: JSON): ${name}FindResponse
        ${name}FindById(_id: ObjectID!, language: String):${name}Entry
      }

      type Mutation{
        insert${name}Entry(input: ${name}Input): ${name}Entry
      }

      input ${name}Input{
        ${this.createProperties(bucket, Action.Mutation)}
      }
    `;

    schema = schema + this.extraInterfaces;

    return schema;
  }

  createProperties(bucket: any, action: Action) {
    return Object.keys(bucket.properties).reduce((acc, key) => {
      let requiredSymbol = "";
      if (bucket.required && bucket.required.includes(key)) {
        requiredSymbol = "!";
      }
      acc =
        acc +
        `
      ${key}: ${this.createType(bucket._id, bucket.properties[key], key, action)}${requiredSymbol}
      `;
      return acc;
    }, "");
  }

  createObjectProperties(bucketId: string, property: any, propertyKey: string, action: Action) {
    return Object.keys(property.properties).reduce((acc, key) => {
      let requiredSymbol = "";
      if (property.required && property.required.includes(key)) {
        requiredSymbol = "!";
      }
      acc =
        acc +
        `
      ${key}: ${this.createType(
          bucketId,
          property.properties[key],
          propertyKey + "_" + key,
          action
        )}${requiredSymbol}
      `;
      return acc;
    }, "");
  }

  createObjectSchema(bucketId: string, property: any, propertyKey: string, action: Action) {
    let defName = this.getBucketName(bucketId) + "_" + propertyKey;
    let definition = "type";

    if (action == Action.Mutation) {
      definition = "input";
      defName = defName + "Input";
    }

    let schema = `
      ${definition} ${defName}{
        ${this.createObjectProperties(bucketId, property, propertyKey, action)}
      }
    `;
    this.extraInterfaces = this.extraInterfaces + schema;
  }

  createEnum(bucketId: string, propertyKey: string, values: string[]) {
    let defName = this.getBucketName(bucketId) + "_" + propertyKey;
    let schema = `
      enum ${defName}{
        ${values.join(",")}
      }
    `;
    this.extraInterfaces = this.extraInterfaces + schema;
  }

  createType(bucketId: string, property: any, propertyKey: string, action: Action) {
    if (property.enum && property.enum.length) {
      //we dont need to create enum for mutations
      if (action == Action.Query) {
        this.createEnum(bucketId, propertyKey, property.enum);
      }
      return this.getBucketName(bucketId) + "_" + propertyKey;
    }
    switch (property.type) {
      case "array":
        return `[${this.createType(bucketId, property.items, propertyKey, action)}]`;

      case "object":
        //we need to push a new type and input for this
        this.createObjectSchema(bucketId, property, propertyKey, action);

        let returnedInterface = this.getBucketName(bucketId) + "_" + propertyKey;

        //inputs cannot include type, it must be input
        if (action == Action.Mutation) {
          returnedInterface = returnedInterface + "Input";
        }

        return returnedInterface;

      case "date":
        return "Date";

      case "number":
        return "Int";

      case "boolean":
        return "Boolean";

      case "location":
        return action == Action.Query ? "Location" : "LocationInput";

      case "relation":
        let relatedBucket = this.buckets.find(bucket => bucket._id == property.bucketId);
        let relationName = "String";

        if (relatedBucket) {
          //mutations inputs should be string or string array for relation fields
          relationName =
            action == Action.Query ? `${this.getBucketName(relatedBucket._id)}Entry` : "String";
        }

        return property.relationType == "onetoone" ? relationName : `[${relationName}]`;

      default:
        return "String";
    }
  }

  createResolver(bucket: Bucket) {
    let name = this.getBucketName(bucket._id);
    let resolver = {
      Query: {
        //GET ALL
        [`${name}Find`]: find(bucket, this.bs, this.bds),

        //GET SINGLE
        [`${name}FindById`]: findById(bucket, this.bs, this.bds)
      },

      //mutations
      Mutation: {
        [`insert${name}Entry`]: insertEntry(bucket, this.bs, this.bds)
      }
    };

    return resolver;
  }

  getBucketName(uniqueField: string | ObjectId): string {
    return `Bucket_${uniqueField.toString()}`;
  }
}

export function find(bucket: any, bs: BucketService, bds: BucketDataService): Function {
  return async (root, {limit, skip, sort, language, filter}, context): Promise<FindResponse> => {
    let aggregation = [];

    //if bucket has translatable property, use language variable or default.
    //otherwise we need to define new interface for localization false.
    let locale: Locale;
    if (hasTranslatedProperties(bucket.properties)) {
      const preferences = await bs.getPreferences();
      locale = findLocale(language ? language : preferences.language.default, preferences);

      aggregation.push({
        $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
      });
    }

    //relation
    for (const propertyKey in bucket.properties) {
      const property = bucket.properties[propertyKey];
      if (property.type == "relation") {
        aggregation.push(
          ...buildRelationAggregation(
            propertyKey,
            property["bucketId"],
            property["relationType"],
            locale
          )
        );
      }
    }

    //put match filter here
    if (filter && Object.keys(filter).length) {
      let bucketProperties = {...bucket.properties, _id: {type: "objectid"}};
      Object.keys(filter).forEach(key => {
        let formattedAggregation;
        if (key == "OR" || key == "AND") {
          let formattedConditions = [];
          let operator = `$${key.toLowerCase()}`;
          filter[key].forEach(condition => {
            Object.keys(condition).forEach(conditionKey => {
              let formattedFilter = formatFilter(
                conditionKey,
                condition[conditionKey],
                bucketProperties
              );
              if (formattedFilter) {
                formattedConditions.push(formattedFilter);
              }
            });
          });
          if (formattedConditions.length) {
            formattedAggregation = {
              $match: {
                [operator]: formattedConditions
              }
            };
          }
        } else {
          let formattedfFilter = formatFilter(key, filter[key], bucketProperties);
          if (formattedfFilter) {
            formattedAggregation = {
              $match: formattedfFilter
            };
          }
        }

        if (formattedAggregation) {
          aggregation.push(formattedAggregation);
        }
      });
    }

    aggregation.push({$skip: skip | 0});

    if (limit) {
      aggregation.push({$limit: limit});
    }

    if (sort && Object.keys(sort).length) {
      aggregation.push({$sort: sort});
    }

    let paginationAggregation = [
      {
        $facet: {
          meta: [{$count: "total"}],
          entries: aggregation
        }
      },
      {$unwind: "$meta"}
    ];

    aggregation = paginationAggregation;

    return bds.find(bucket._id, aggregation).then(response => response[0] as FindResponse);
  };
}

export function findById(bucket: any, bs: BucketService, bds: BucketDataService): Function {
  return async (root, {_id, language}, context): Promise<BucketDocument> => {
    let aggregation = [];

    aggregation.push({
      $match: {
        _id: _id
      }
    });

    //if bucket has translatable property, use language variable or default.
    //otherwise we need to define new interface for localization false
    let locale: Locale;
    if (hasTranslatedProperties(bucket.properties)) {
      const preferences = await bs.getPreferences();
      locale = findLocale(language ? language : preferences.language.default, preferences);

      aggregation.push({
        $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
      });
    }

    //relation
    for (const propertyKey in bucket.properties) {
      const property = bucket.properties[propertyKey];
      if (property.type == "relation") {
        aggregation.push(
          ...buildRelationAggregation(
            propertyKey,
            property["bucketId"],
            property["relationType"],
            locale
          )
        );
      }
    }

    return bds.find(bucket._id, aggregation).then(entries => entries[0]);
  };
}

export function insertEntry(bucket: any, bs: BucketService, bds: BucketDataService): Function {
  return async (_, {input}): Promise<BucketDocument> => {
    let insertResult = await bds.insertOne(bucket._id, input);
    //resolve relations if bucket has relation field
    if (
      Object.keys(bucket.properties).some(
        property => bucket.properties[property].type == "relation"
      )
    ) {
      return findById(bucket, bs, bds)({}, {_id: insertResult.insertedId, language: undefined}, {});
    } else {
      return {...input, _id: insertResult.insertedId};
    }
  };
}

export function castToOriginalType(value: any, property: any): unknown {
  switch (property.type) {
    case "date":
      return new Date(value);
    case "objectid":
      return new ObjectID(value);
    case "array":
      return value.map(val => castToOriginalType(val, property.items));
    default:
      return value;
  }
}

export function formatFilter(key: string, value: any, bucketProperties: any): object {
  let property = key.substring(0, key.lastIndexOf("_"));
  let operator = key.substring(key.lastIndexOf("_") + 1);
  let desiredProperty = Object.keys(bucketProperties).find(
    bucketProperty => bucketProperty == property
  );
  if (desiredProperty && operator) {
    value = castToOriginalType(value, bucketProperties[desiredProperty]);
    return {
      [desiredProperty]: {
        [`$${operator}`]: value
      }
    };
  } else {
    let desiredProperty = Object.keys(bucketProperties).find(
      bucketProperty => bucketProperty == key
    );
    if (desiredProperty) {
      value = castToOriginalType(value, bucketProperties[desiredProperty]);
      return {
        [desiredProperty]: value
      };
    }
  }

  return undefined;
}

//guards
async (req, res, next) => {
  try {
    await this.guardService.checkAuthorization({
      request: req,
      response: res
    });
    await this.guardService.checkAction({
      request: req,
      response: res,
      actions: ["bucket:data:create"]
    });
    return {
      schema: this.schema,
      //rootValue: this.resolver,
      graphiql: true
    };
  } catch (e) {
    console.log(e);
    throw new UnauthorizedException();
    //res.end(JSON.stringify({code: e.status || 500, message: e.message}));
  }
};
