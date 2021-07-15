export interface Status {
  module: string;
  status: {
    [key: string]: {
      limit?: number;
      current: number;
      unit: string;
    };
  };
}

export interface StatusProvider {
  module: string;
  provide: (...args) => Promise<Status>;
}
