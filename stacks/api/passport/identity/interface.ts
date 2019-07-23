export interface Identity {
  identifier: string;
  password: string;
  policies: string[];
}
export interface Service {
  $resource: string;
  $format?: string;
  title: string;
  actions: string[];
}
