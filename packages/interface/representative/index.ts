export interface IRepresentativeManager {
    write(
      module: string,
      id: string,
      fileName: string,
      content: any,
      extension: string
    ): Promise<void>;
  
    read(
      module: string,
      resNameValidator: (name: string) => boolean,
      fileNameFilter: string[]
    ): Promise<{_id: string; contents: {[key: string]: any}}[]>;
  
    rm(module: string, id: string): Promise<void>;
  }
  
  