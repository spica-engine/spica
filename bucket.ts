import * as Bucket from '@spica-devkit/bucket';
/**
 * Call this method before interacting with buckets.
 * @param initOptions Initialize options to initialize the '@spica-devkit/bucket'.
 */
export function initialize(
  ...initOptions: Parameters<typeof Bucket.initialize>
) {
  initOptions[0].publicUrl = 'https://master.spicaengine.com/api';
  Bucket.initialize(...initOptions);
}

type Rest<T extends any[]> = ((...p: T) => void) extends ((p1: infer P1, ...rest: infer R) => void) ? R : never;
type getArgs = Rest<Parameters<typeof Bucket.data.get>>;
type getAllArgs = Rest<Parameters<typeof Bucket.data.getAll>>;
type realtimeGetArgs = Rest<Parameters<typeof Bucket.data.realtime.get>>;
type realtimeGetAllArgs = Rest<Parameters<typeof Bucket.data.realtime.getAll>>;

interface New_Bucket2{
  _id: string;
  title?: string;
  description?: string;
}
export namespace new_bucket2 {
  const BUCKET_ID = '61444eb3d54da7002d0f54d1';
    export function get (...args: getArgs) {
      return Bucket.data.get<New_Bucket2>(BUCKET_ID, ...args);
    };
    export function getAll (...args: getAllArgs) {
      return Bucket.data.getAll<New_Bucket2>(BUCKET_ID, ...args);
    };
    export function insert (document: Omit<New_Bucket2, '_id'>) {
      
      return Bucket.data.insert(BUCKET_ID, document);
    };
    export function update (document: New_Bucket2) {
      
      return Bucket.data.update(
        BUCKET_ID,
        document._id,
        document
      );
    };  
    export function patch (
      document: Omit<Partial<New_Bucket2>, '_id'> & { _id: string }
    ) {
      
      return Bucket.data.patch(BUCKET_ID, document._id, document);
    };  
    export function remove (documentId: string) {
      return Bucket.data.remove(BUCKET_ID, documentId);
    };
  export namespace realtime {
      export function get (...args: realtimeGetArgs) {
        return Bucket.data.realtime.get<New_Bucket2>(BUCKET_ID, ...args);
      };
      export function getAll (...args: realtimeGetAllArgs) {
        return Bucket.data.realtime.getAll<New_Bucket2>(BUCKET_ID, ...args);
      };
  }
}

interface New_Bucket{
  _id: string;
  title?: string;
  description?: string;
  date?: Date | string;
  number?: (1|2|6123);
  boolean?: boolean;
  array?: string[];
  multiselect?: ('test'|'test333')[];
  object?: {
  string?: string;};
  color?: string;
  storage?: string;
  relationmany?: (New_Bucket | string)[];
  richtexy?: string;
  location?: { type: "Point", coordinates: [number,number]};
  relation2?: (New_Bucket2 | string);
}
export namespace new_bucket {
  const BUCKET_ID = '614085d7d54da7002d0f52df';
    export function get (...args: getArgs) {
      return Bucket.data.get<New_Bucket>(BUCKET_ID, ...args);
    };
    export function getAll (...args: getAllArgs) {
      return Bucket.data.getAll<New_Bucket>(BUCKET_ID, ...args);
    };
    export function insert (document: Omit<New_Bucket, '_id'>) {
      ['relationmany','relation2'].forEach((field) => {
        if (typeof document[field] == 'object') {
          document[field] = Array.isArray(document[field])
            ? document[field].map((v) => v._id)
            : document[field]._id;
        }
      });
      return Bucket.data.insert(BUCKET_ID, document);
    };
    export function update (document: New_Bucket) {
      ['relationmany','relation2'].forEach((field) => {
        if (typeof document[field] == 'object') {
          document[field] = Array.isArray(document[field])
            ? document[field].map((v) => v._id)
            : document[field]._id;
        }
      });
      return Bucket.data.update(
        BUCKET_ID,
        document._id,
        document
      );
    };  
    export function patch (
      document: Omit<Partial<New_Bucket>, '_id'> & { _id: string }
    ) {
      ['relationmany','relation2'].forEach((field) => {
        if (typeof document[field] == 'object') {
          document[field] = Array.isArray(document[field])
            ? document[field].map((v) => v._id)
            : document[field]._id;
        }
      });
      return Bucket.data.patch(BUCKET_ID, document._id, document);
    };  
    export function remove (documentId: string) {
      return Bucket.data.remove(BUCKET_ID, documentId);
    };
  export namespace realtime {
      export function get (...args: realtimeGetArgs) {
        return Bucket.data.realtime.get<New_Bucket>(BUCKET_ID, ...args);
      };
      export function getAll (...args: realtimeGetAllArgs) {
        return Bucket.data.realtime.getAll<New_Bucket>(BUCKET_ID, ...args);
      };
  }
}