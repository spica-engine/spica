import {useEffect, useMemo} from "react";
import type {BucketType, Property} from "src/services/bucketService";
import {FIELD_REGISTRY} from "../../../domain/fields/registry";
import type {TypeArrayItems} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import {
  useRelationInputHandlers,
  type RelationState
} from "../../../hooks/useRelationInputHandlers";
import {collectBucketIds} from "./NewBucketEntryPopupUtils";
import { FieldKind } from "src/domain/fields";

export const useValueProperties = (bucket: BucketType, authToken: string) => {
  const {relationStates, getOptionsMap, loadMoreOptionsMap, searchOptionsMap, ensureHandlers} =
    useRelationInputHandlers(authToken);

  const bucketIds = useMemo(
    () => collectBucketIds(bucket.properties || {}, null),
    [bucket.properties]
  );
  useEffect(() => {
    for (const b of bucketIds) {
      ensureHandlers(b.bucketId, b.bucketId);
    }
  }, []);

  const valueProperties = useMemo(() => {
    if (bucketIds.length > 0 && !Object.keys(relationStates).length) return {};
    const properties = bucket?.properties || {};
    const output: Record<string, any> = {};
    for (const [key, prop] of Object.entries(properties || {})) {
      const kind = prop.type;
      const fieldDefinition = kind ? FIELD_REGISTRY[kind] : undefined;
      if (!fieldDefinition) {
        output[key] = {...prop, id: crypto.randomUUID()};
        continue;
      }
      let base;
      if (kind === FieldKind.Relation) {
        const relationProps = {
          getOptions: getOptionsMap.current[prop.bucketId],
          loadMoreOptions: loadMoreOptionsMap.current[prop.bucketId],
          searchOptions: searchOptionsMap.current[prop.bucketId],
          totalOptionsLength: relationStates?.[prop.bucketId]?.total || 0,
          relationState: relationStates?.[prop.bucketId] as RelationState
        };
        base = fieldDefinition.buildValueProperty(prop, relationProps);
      } else if (kind === FieldKind.Object) {
        const relationProps = {
          getOptionsMap: getOptionsMap.current,
          loadMoreOptionsMap: loadMoreOptionsMap.current,
          searchOptionsMap: searchOptionsMap.current,
          relationStates: relationStates as Record<string, RelationState>,
          totalOptionsLength: relationStates?.[key]?.total || 0
        };
        base = fieldDefinition.buildValueProperty(prop, relationProps);
      } else if (kind === FieldKind.Array) {
        const relationProps = {
          getOptionsMap: getOptionsMap.current,
          loadMoreOptionsMap: loadMoreOptionsMap.current,
          searchOptionsMap: searchOptionsMap.current,
          relationStates: relationStates as Record<string, RelationState>,
          totalOptionsLength: relationStates?.[key]?.total || 0
        };
        base = fieldDefinition.buildValueProperty(prop, relationProps);
      } else {
        base = fieldDefinition.buildValueProperty(prop);
      }

      if (kind === FieldKind.Multiselect) {
        base.enum = prop.items.enum || [];
      }

      const keys = [
        "minimum",
        "maximum",
        "minItems",
        "maxItems",
        "pattern",
        "enum",
        "relationType",
        "bucketId",
        "required",
        "default"
      ] as (keyof (Property | TypeArrayItems))[];
      for (const k of keys) {
        if (prop?.[k as string] !== undefined) {
          base[k] = prop[k as string];
        }
      }
      output[key] = base;
    }

    return output;
  }, [
    bucket.properties,
    ensureHandlers,
    getOptionsMap,
    loadMoreOptionsMap,
    searchOptionsMap,
    relationStates,
    bucketIds.length
  ]);
  return valueProperties;
};
