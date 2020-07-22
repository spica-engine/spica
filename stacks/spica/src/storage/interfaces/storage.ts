export interface Storage {
  _id?: string;
  name: string;
  url?: string;
  content?: {
    type: string;
    size?: number;
  };
}
