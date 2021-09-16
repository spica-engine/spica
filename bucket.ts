import * as Bucket from '@spica-devkit/bucket';
Bucket.initialize({apikey:'10w6lb18kk6uky7z',publicUrl:'https://master.spicaengine.com/api'});

type Rest<T extends any[]> = ((...p: T) => void) extends ((p1: infer P1, ...rest: infer R) => void) ? R : never;
type getArgs = Rest<Parameters<typeof Bucket.data.get>>;
type getAllArgs = Rest<Parameters<typeof Bucket.data.getAll>>;
type realtimeGetArgs = Rest<Parameters<typeof Bucket.data.realtime.get>>;
type realtimeGetAllArgs = Rest<Parameters<typeof Bucket.data.realtime.getAll>>;

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
      return Bucket.data.insert(BUCKET_ID, document);
    };
    export function update (document: New_Bucket) {
      return Bucket.data.update(
        BUCKET_ID,
        document._id,
        document
      );
    };  
    export function patch (
      document: Omit<Partial<New_Bucket>, '_id'> & { _id: string }
    ) {
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