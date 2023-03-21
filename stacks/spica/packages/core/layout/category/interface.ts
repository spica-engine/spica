import {Route} from "../../route";

export interface CategorizedRoutes {
  [propValue: string]: Route[];
}
export interface CategoryOrder {
  name: string;
  order: number;
}
