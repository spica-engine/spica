export interface Service {
  $resource: string;
  $arguments?: string;
  title: string;
  actions: string[] | string;
  parsedArguments?: any[];
}
