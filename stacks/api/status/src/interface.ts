export interface Status {
  module: string;
  status: {
    [key: string]: {
      [key: string]: any;
    };
  };
}

export interface StatusProvider {
  module: string;
  submodule?:string;
  provide: (...args) => Promise<Status>;
}
