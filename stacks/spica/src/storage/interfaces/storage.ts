export interface Storage {
  _id?: string;
  name: string;
  url?: string;
  content?: {type: string; data?: {type: string; data: Iterable<number>}; size?: number};
}
