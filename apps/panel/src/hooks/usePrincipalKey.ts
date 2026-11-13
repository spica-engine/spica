import {principalKeyFor} from "../utils/recordKey";
import {useEngine} from "./useEngine";

export function usePrincipalKey(): string {
  return principalKeyFor(useEngine());
}
