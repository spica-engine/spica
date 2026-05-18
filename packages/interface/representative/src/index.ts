import {Observable} from "rxjs";

export enum ChangeType {
  INSERT = 0,
  UPDATE = 1,
  DELETE = 2,
  REPLACE = 3
}

export interface IRepresentativeManager {
  write(
    module: string,
    id: string,
    file: string,
    content: any,
    extension: string,
    accessMode?: "readwrite" | "readonly"
  ): Promise<void>;

  read(module: string, id: string, fileName: string): Promise<any>;

  rm(module?: string, id?: string): Promise<void>;

  watch(module: string, file: string[], events?: string[]): Observable<RepresentativeFileEvent>;
}

export interface RepresentativeFileEvent {
  slug: string;
  content: string;
  extension: string;
  type: ChangeType;
  event_id: string;
}
