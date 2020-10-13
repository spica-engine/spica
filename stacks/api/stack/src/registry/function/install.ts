import { Resource } from "../../definition";
import {makeKey, register} from "../../scheme";
import {Function} from "./definition";

register({
    definition: Function,
    lift: (store, object: Resource<any>) => {
        const { spec } = object; 
        const env = {};
        const buckets = store.get(makeKey({group: 'bucket', resource: 'schemas'}))

        for (const {key, value, valueFrom} of spec.environment) {
  
          if ( value ) {
            env[key] = String(value);
          } else if ( valueFrom ) {
            if ( valueFrom.resourceFieldRef && valueFrom.resourceFieldRef.bucketName ) {
              const bucket = buckets.get(valueFrom.resourceFieldRef.bucketName);
              if ( bucket ) {
                env[key] = String(bucket.metadata.uid);
                continue;
              }
            }
            return object.status = "Error";
          }
        }

        globalThis["liftFunction"](object, env, store);
    }
});
