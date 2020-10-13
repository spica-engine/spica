import { makeKey, register } from "../../scheme";
import { Bucket } from "./definition";

register({
  definition: Bucket,
  lift: (store, object: any) => {
    const objects = store.get(makeKey({group: 'bucket', resource: 'schemas'}))
    const {spec, status} = object;
    for (const propertyName in spec.properties) {
      const property = spec.properties[propertyName];
      if (property.type == "relation" && typeof property.bucket == "object") {
        const bucketName = property.bucket.valueFrom.resourceFieldRef.bucketName;
        // TODO: handle downwards resources via generic function
        if (!objects.has(bucketName)) {
            object.status = "Error";
            return;
        }
      }
    }

    globalThis["liftBucket"](object, objects);
  }
});


