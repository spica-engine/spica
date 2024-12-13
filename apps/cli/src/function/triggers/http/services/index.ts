import {FunctionModifiers} from "../../../interface";
import {axios} from "./axios";
export {Axios, AxiosReadValidator, AxiosWriteValidator} from "./axios";

export const httpServiceModifiers: FunctionModifiers = new Map([[axios.name, axios.factory]]);
// add new http services here, like got, node-fetch etc.
