import {PreferencesMeta} from "@spica-client/core/preferences";
export interface BucketSettings extends PreferencesMeta {
  language: {
    available: {
      [code: string]: string;
    };
    default: string;
  };
}
