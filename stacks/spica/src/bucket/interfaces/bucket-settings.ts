import {PreferencesMeta} from "@spica-client/core/preferences";
export interface BucketSettings extends PreferencesMeta {
  language: {
    supported_languages: {name: string; code: string}[];
    default: {name: string; code: string};
  };
}
