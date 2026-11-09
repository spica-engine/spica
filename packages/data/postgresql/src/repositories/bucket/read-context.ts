import {BucketReadContext} from "@spica-server/interface-bucket-common";

const unavailable = () => Promise.reject(new Error("Schemas and preferences are not read here."));

export const keyedReadContext: BucketReadContext = {
  resolveSchema: unavailable,
  preferences: unavailable
};
