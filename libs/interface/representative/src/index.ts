import {Observable} from "rxjs";
import {
  ChangeType,
  RepChange,
  RepresentativeManagerResource
} from "@spica-server/interface/versioncontrol";

export interface IRepresentativeManager {
  write(
    module: string,
    id: string,
    file: string,
    content: any,
    extension: string,
    accessMode?: "readwrite" | "readonly"
  ): Promise<void>;

  read(
    module: string,
    resNameValidator: (name: string) => boolean,
    fileNameFilter: string[]
  ): Promise<{_id: string; contents: {[key: string]: any}}[]>;

  rm(module?: string, id?: string): Promise<void>;

  watch(
    module: string,
    file: string[],
    events?: string[]
  ): Observable<RepChange<RepresentativeManagerResource>>;
}

// remove old code and rename it
export interface IIRepresentativeManager {
  write(module: string, id: string, file: string, content: any, extension: string): Promise<void>;

  read(module: string, file: string): Promise<any>;

  rm(module?: string, id?: string): Promise<void>;

  watch(
    module: string,
    file: string[],
    events?: string[]
  ): Observable<{
    slug: string;
    content: string;
    type: ChangeType;
  }>;
}
