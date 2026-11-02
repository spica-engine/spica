import {Property} from "../schema/metadata/property.js";
import {PROPERTY_SHAPERS, PropertyVisit, Shaping} from "./property-shapers.js";
import {RowSet} from "./row-set.js";
import {BucketDescription, Scope, ShapeEnvironment} from "./scope.js";
import {Document} from "./values.js";

export class BucketShaper {
  shape(rowSet: RowSet, description: BucketDescription, environment: ShapeEnvironment): Document {
    return this.shaping(environment).document(rowSet, description);
  }

  private shaping(environment: ShapeEnvironment): Shaping {
    const shaping: Shaping = {
      environment,
      property: (visit: PropertyVisit) =>
        PROPERTY_SHAPERS.find(shaper => shaper.matches(visit)).shape(visit, shaping),
      object: (scope: Scope, path: string[], properties: Record<string, Property>) =>
        Object.fromEntries(
          Object.entries(properties).map(([name, property]) => [
            name,
            shaping.property({scope, path: [...path, name], property})
          ])
        ),
      document: (rowSet: RowSet, description: BucketDescription) =>
        shaping.object(
          {description, rowSet, table: description.metadata.main, row: rowSet.main},
          [],
          description.definition.properties as Record<string, Property>
        )
    };
    return shaping;
  }
}
