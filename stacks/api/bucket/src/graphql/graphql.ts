import {graphqlHTTP} from "express-graphql";
import {HttpAdapterHost} from "@nestjs/core";
import {Injectable, UnauthorizedException, Optional, PipeTransform} from "@nestjs/common";
import {BucketDataService} from "../bucket-data.service";
import {ObjectID, ObjectId} from "@spica-server/database";
import {BucketService, Bucket, BucketDocument} from "@spica-server/bucket/services";
import {GraphQLScalarType, GraphQLSchema, ValueNode} from "graphql";

import {makeExecutableSchema, mergeTypeDefs, mergeResolvers} from "graphql-tools";
import {hasTranslatedProperties, findLocale, buildI18nAggregation, Locale} from "../locale";
import {buildRelationAggregation, clearRelations, createHistory} from "../utility";
import {GuardService} from "@spica-server/passport";
import {HistoryService} from "@spica-server/bucket/history";
import {createActivity, ActivityService} from "@spica-server/activity/services";
import {createBucketDataActivity} from "../activity.resource";
import {Schema, Validator} from "@spica-server/core/schema";

const JsonMergePatch = require("json-merge-patch");

enum Definition {
  Type = "type",
  Input = "input"
}

interface FindResponse {
  meta: {total: number};
  entries: BucketDocument[];
}

@Injectable()
export class GraphqlEnpointHandler {
  schema: GraphQLSchema;

  buckets: Bucket[] = [];

  validatorPipes: Map<ObjectId, PipeTransform<any, any>> = new Map();

  //graphql needs a default schema that includes one type and resolver at least
  typeDefs = [
    `type Query{
      spica: String
    }`
  ];

  resolvers: any[] = [
    {
      Query: {
        spica: () => "Spica"
      }
    }
  ];

  staticTypes = `
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

  dateScalar = new GraphQLScalarType({
    name: "Date",
    description: "JavaScript Date object. Value will be passed to Date constructor."
  });

  JSONScalar = new GraphQLScalarType({
    name: "JSON",
    description: "JavaScript Object Notation."
  });

  objectIdScalar = new GraphQLScalarType({
    name: "ObjectID",
    description:
      "BSON ObjectId type. Can be a 24 byte hex string, 12 byte binary string or a Number.",
    parseValue(value) {
      return new ObjectID(value);
    },
    serialize(value) {
      return value.toString();
    },
    parseLiteral(ast: ValueNode) {
      let value = ast["value"];
      if (ObjectID.isValid(value)) {
        return new ObjectID(value);
      }
      return null;
    }
  });

  extraInterfaces = "";

  constructor(
    private adapterHost: HttpAdapterHost,
    private bs: BucketService,
    private bds: BucketDataService,
    private guardService: GuardService,
    private activity: ActivityService,
    private validator: Validator,
    @Optional() private history: HistoryService
  ) {
    let app = this.adapterHost.httpAdapter.getInstance();

    this.bs.watchCollection(true).subscribe(buckets => {
      this.buckets = buckets;

      if (buckets.length) {
        //typeDefs
        this.typeDefs = buckets.map(bucket => this.createSchema(bucket));
        this.typeDefs.push(this.staticTypes);

        //resolvers
        this.resolvers = buckets.map(bucket => this.createResolver(bucket));
        this.resolvers.push({
          Date: this.dateScalar,
          ObjectID: this.objectIdScalar,
          JSON: this.JSONScalar
        });
      }

      this.schema = makeExecutableSchema({
        typeDefs: mergeTypeDefs(this.typeDefs),
        resolvers: mergeResolvers(this.resolvers)
      });
    });

    app.use(
      "/graphql",
      graphqlHTTP(async (request, response, gqlParams) => {
        let isAuthorized = await this.guardService
          .checkAuthorization({
            request,
            response
          })
          .catch(err => {
            //console.log(err);

            //for development
            return true;
          });

        if (!isAuthorized) {
          throw new UnauthorizedException();
        }

        return {
          schema: this.schema,
          graphiql: true
        };
      })
    );
  }

  //schema methods
  createSchema(bucket: Bucket) {
    this.extraInterfaces = "";
    let name = this.getBucketName(bucket._id);
    let schema = `

      type ${name}FindResponse{
        meta: Meta
        entries: [${name}Entry]
      }

      type ${name}Entry{
        _id: ObjectID
        ${this.createProperties(bucket, Definition.Type)}
      }

      type Query{
        ${name}Find(limit: Int, skip: Int, sort: JSON ,language: String, query: JSON): ${name}FindResponse
        ${name}FindById(_id: ObjectID!, language: String):${name}Entry
      }

      type Mutation{
        insert${name}Entry(input: ${name}Input): ${name}Entry
        replace${name}Entry(_id: ObjectID!, input: ${name}Input): ${name}Entry
        patch${name}Entry(_id: ObjectID!, input: JSON): ${name}Entry
        delete${name}Entry(_id: ObjectID!): Boolean
      }

      input ${name}Input{
        ${this.createProperties(bucket, Definition.Input)}
      }
    `;

    schema = schema + this.extraInterfaces;

    return schema;
  }

  createProperties(bucket: Bucket, definition: Definition) {
    return Object.keys(bucket.properties).reduce((acc, key) => {
      let requiredSymbol = "";
      if (bucket.required && bucket.required.includes(key)) {
        requiredSymbol = "!";
      }
      acc =
        acc +
        `
      ${key}: ${this.createType(
          bucket._id,
          bucket.properties[key],
          key,
          definition
        )}${requiredSymbol}
      `;
      return acc;
    }, "");
  }

  createObjectSchema(
    bucketId: ObjectId,
    property: any,
    propertyKey: string,
    definition: Definition
  ) {
    let defName = this.getBucketName(bucketId) + "_" + propertyKey;

    if (definition == Definition.Input) {
      defName = defName + "Input";
    }

    let schema = `
      ${definition} ${defName}{
        ${this.createObjectProperties(bucketId, property, propertyKey, definition)}
      }
    `;
    this.extraInterfaces = this.extraInterfaces + schema;
  }

  createObjectProperties(
    bucketId: ObjectId,
    property: any,
    propertyKey: string,
    definition: Definition
  ) {
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
          definition
        )}${requiredSymbol}
      `;
      return acc;
    }, "");
  }

  createEnum(bucketId: ObjectId, propertyKey: string, values: string[]) {
    let defName = this.getBucketName(bucketId) + "_" + propertyKey;
    let schema = `
      enum ${defName}{
        ${values.join(",")}
      }
    `;
    this.extraInterfaces = this.extraInterfaces + schema;
  }

  createType(bucketId: ObjectID, property: any, propertyKey: string, definition: Definition) {
    if (property.enum && property.enum.length) {
      //we dont need to create enum for inputs
      if (definition == Definition.Type) {
        this.createEnum(bucketId, propertyKey, property.enum);
      }
      return this.getBucketName(bucketId) + "_" + propertyKey;
    }
    switch (property.type) {
      case "array":
        return `[${this.createType(bucketId, property.items, propertyKey, definition)}]`;

      case "object":
        this.createObjectSchema(bucketId, property, propertyKey, definition);

        let defName = this.getBucketName(bucketId) + "_" + propertyKey;

        //inputs cannot include type, it must be input
        if (definition == Definition.Input) {
          defName = defName + "Input";
        }

        return defName;

      case "date":
        return "Date";

      case "number":
        return "Int";

      case "boolean":
        return "Boolean";

      case "location":
        return definition == Definition.Type ? "Location" : "LocationInput";

      case "relation":
        let relatedBucket = this.buckets.find(bucket => bucket._id == property.bucketId);
        let relatedDefName = "String";

        if (relatedBucket) {
          //mutations inputs should be string or string array for relation fields
          relatedDefName =
            definition == Definition.Type
              ? `${this.getBucketName(relatedBucket._id)}Entry`
              : "String";
        }

        return property.relationType == "onetoone" ? relatedDefName : `[${relatedDefName}]`;

      case "string":
        return "String";

      default:
        return "String";
    }
  }

  createResolver(bucket: Bucket) {
    let name = this.getBucketName(bucket._id);
    let resolver = {
      Query: {
        [`${name}Find`]: this.find(bucket),
        [`${name}FindById`]: this.findById(bucket)
      },

      Mutation: {
        [`insert${name}Entry`]: this.insertEntry(bucket),
        [`replace${name}Entry`]: this.replaceEntry(bucket),
        [`patch${name}Entry`]: this.patchEntry(bucket),
        [`delete${name}Entry`]: this.deleteEntry(bucket)
      }
    };

    return resolver;
  }

  //resolver methods
  find(bucket: Bucket): Function {
    return async (root, {limit, skip, sort, language, query}, context): Promise<FindResponse> => {
      let subAggregation = [];

      let locale: Locale;
      if (hasTranslatedProperties(bucket.properties)) {
        const preferences = await this.bs.getPreferences();
        locale = findLocale(language ? language : preferences.language.default, preferences);

        subAggregation.push({
          $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
        });
      }

      for (const propertyKey in bucket.properties) {
        const property = bucket.properties[propertyKey];
        if (property.type == "relation") {
          subAggregation.push(
            ...buildRelationAggregation(
              propertyKey,
              property["bucketId"],
              property["relationType"],
              locale
            )
          );
        }
      }

      if (query && Object.keys(query).length) {
        let matchExpression = this.extractExpressionFromQuery(bucket, query);
        if (matchExpression && Object.keys(matchExpression).length) {
          subAggregation.push({$match: matchExpression});
        }
      }

      subAggregation.push({$skip: skip | 0});

      if (limit) {
        subAggregation.push({$limit: limit});
      }

      if (sort && Object.keys(sort).length) {
        subAggregation.push({$sort: sort});
      }

      let aggregation = [
        {
          $facet: {
            meta: [{$count: "total"}],
            entries: subAggregation
          }
        },
        {$unwind: "$meta"}
      ];

      return this.bds.find(bucket._id, aggregation).then(response => response[0] as FindResponse);
    };
  }

  findById(bucket: Bucket): Function {
    return async (root, {_id, language}, context): Promise<BucketDocument> => {
      let aggregation = [];

      aggregation.push({
        $match: {
          _id: _id
        }
      });

      let locale: Locale;
      if (hasTranslatedProperties(bucket.properties)) {
        const preferences = await this.bs.getPreferences();
        locale = findLocale(language ? language : preferences.language.default, preferences);

        aggregation.push({
          $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
        });
      }

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

      return this.bds.find(bucket._id, aggregation).then(entries => entries[0]);
    };
  }

  insertEntry(bucket: Bucket): Function {
    return async (root, {input}, context): Promise<BucketDocument> => {
      // await this.guardService.checkAuthorization({
      //   request: context,
      //   response: {}
      // });

      await this.validateInput(bucket._id, input);

      let insertResult = await this.bds.insertOne(bucket._id, input);

      const _ = this.insertActivity(context, "POST", bucket._id, insertResult.insertedId);

      //resolve relations if bucket has relation field
      if (
        Object.keys(bucket.properties).some(
          property => bucket.properties[property].type == "relation"
        )
      ) {
        let findById = this.findById(bucket);
        return findById(root, {_id: insertResult.insertedId, language: undefined}, context);
      }

      return {...input, _id: insertResult.insertedId};
    };
  }

  replaceEntry(bucket: Bucket): Function {
    return async (root, {_id, input}, context): Promise<BucketDocument> => {
      // await this.guardService.checkAuthorization({
      //   request: context,
      //   response: {}
      // });

      await this.validateInput(bucket._id, input);

      const {value: previousDocument} = await this.bds.replaceOne(bucket._id, {_id: _id}, input, {
        returnOriginal: true
      });

      const currentDocument = {...input, _id: _id};

      const _ = this.insertActivity(context, "PUT", bucket._id, _id);

      if (this.history) {
        const promise = createHistory(
          this.bs,
          this.history,
          bucket._id,
          previousDocument,
          currentDocument
        );
      }

      if (
        Object.keys(bucket.properties).some(
          property => bucket.properties[property].type == "relation"
        )
      ) {
        let findById = this.findById(bucket);
        return findById(root, {_id, language: undefined}, context);
      }

      return currentDocument;
    };
  }

  patchEntry(bucket: Bucket): Function {
    return async (root, {_id, input}, context) => {
      // await this.guardService.checkAuthorization({
      //   request: context,
      //   response: {}
      // });
      let document = await this.bds.findOne(bucket._id, {_id});

      let patchedDocument = JsonMergePatch.apply(document, input);

      let replace = this.replaceEntry(bucket);

      return replace(root, {_id, input: patchedDocument}, context);
    };
  }

  deleteEntry(bucket: Bucket): Function {
    return async (root, {_id}, context): Promise<Boolean> => {
      // await this.guardService.checkAuthorization({
      //   request: context,
      //   response: {}
      // });

      await clearRelations(this.bs, bucket._id, _id);
      if (this.history) {
        const promise = this.history.deleteMany({
          document_id: _id
        });
      }

      let result = await this.bds.deleteOne(bucket._id, {_id: _id}).then(res => !!res.deletedCount);

      const _ = this.insertActivity(context, "DELETE", bucket._id, _id);

      return result;
    };
  }

  //activity logs
  insertActivity(
    context: any,
    method: "POST" | "PUT" | "DELETE",
    bucketId: string | ObjectId,
    documentId: string | ObjectId
  ) {
    context.params.bucketId = bucketId;
    context.params.documentId = documentId;
    context.method = method;

    const response = {
      _id: documentId
    };

    return createActivity(
      {
        switchToHttp: () => ({
          getRequest: () => context
        })
      } as any,
      response,
      createBucketDataActivity,
      this.activity
    );
  }

  //aggregation helpers
  extractExpressionFromQuery(bucket: Bucket, query: object) {
    //example query => { OR: [ { title:"my_title" } , { age_gt : 21 }  ] }
    //expected aggregation => { $or: [ { title:"my_title" } , $gt: { age: 21 } ] }
    let bucketProperties = {...bucket.properties, _id: {type: "objectid"}};

    let matchExpression = {};
    Object.keys(query).forEach(key => {
      let expression;
      if (key == "OR" || key == "AND") {
        let conditions = [];
        let operator = `$${key.toLowerCase()}`;
        query[key].forEach(condition => {
          //each condition is query, for example, it may include or operator inside of or
          let conditionExpression = this.extractExpressionFromQuery(bucket, condition);

          if (conditionExpression && Object.keys(conditionExpression).length) {
            conditions.push(conditionExpression);
          }
        });

        if (conditions.length) {
          expression = {
            [operator]: conditions
          };
        }
      } else {
        let inner_expression = this.createExpression(key, query[key], bucketProperties);
        if (inner_expression) {
          expression = inner_expression;
        }
      }

      matchExpression = {...matchExpression, ...expression};
    });

    return matchExpression;
  }

  validateInput(bucketId: ObjectId, input: BucketDocument) {
    let pipe: any = this.validatorPipes.get(bucketId);

    if (!pipe) {
      let validatorMixin = Schema.validate(bucketId.toHexString());
      pipe = new validatorMixin(this.validator);
      this.validatorPipes.set(bucketId, pipe);
    }

    return pipe.transform(input);
  }

  castToOriginalType(value: any, property: any): unknown {
    switch (property.type) {
      case "date":
        return new Date(value);
      case "objectid":
        return new ObjectID(value);
      case "array":
        return value.map(val => this.castToOriginalType(val, property.items));
      default:
        return value;
    }
  }

  createExpression(key: string, value: any, bucketProperties: any): object {
    //case => { title:"test" }
    //output => { title:"test" }
    let desiredProperty = Object.keys(bucketProperties).find(
      bucketProperty => bucketProperty == key
    );

    if (desiredProperty) {
      value = this.castToOriginalType(value, bucketProperties[desiredProperty]);
      return {
        [desiredProperty]: value
      };
    } else {
      //case => { title_ne:"test" }
      //output => { $ne: { title: "test" } }
      let property = key.substring(0, key.lastIndexOf("_"));
      let operator = key.substring(key.lastIndexOf("_") + 1);
      let desiredProperty = Object.keys(bucketProperties).find(
        bucketProperty => bucketProperty == property
      );

      if (desiredProperty && operator) {
        value = this.castToOriginalType(value, bucketProperties[desiredProperty]);
        return {
          [desiredProperty]: {
            [`$${operator}`]: value
          }
        };
      }
    }
  }

  getBucketName(uniqueField: string | ObjectId): string {
    return `Bucket_${uniqueField.toString()}`;
  }
}

//guards
async (req, res, params) => {
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
