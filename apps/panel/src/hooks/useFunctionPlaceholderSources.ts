import {useCallback, useMemo} from "react";
import {useGetEnvVarsQuery} from "../store/api/envVarApi";
import {useInjectEnvVarMutation, type SpicaFunction} from "../store/api/functionApi";
import {toPlaceholder, unattachedReferences} from "../domain/placeholder";
import {idOf} from "../utils/recordKey";

const MISSING_PERMISSION_HINT = "Dynamic values are unavailable: missing env-var read permission.";

const isForbidden = (error: unknown) => (error as {status?: number} | undefined)?.status === 403;

export function useFunctionPlaceholderSources(fn?: SpicaFunction) {
  const envVars = useGetEnvVarsQuery();
  const [injectEnvVar] = useInjectEnvVarMutation();

  const envVarKeys = useMemo(
    () => (envVars.isSuccess ? envVars.data.data.map(item => item.key) : null),
    [envVars.isSuccess, envVars.data]
  );

  const attachedPlaceholders = useMemo(
    () => new Set((fn?.env_vars ?? []).map(item => toPlaceholder({source: "ENV", key: item.key}))),
    [fn?.env_vars]
  );

  const attach = useCallback(
    async (functionId: string, values: unknown[]) => {
      const references = unattachedReferences(values, attachedPlaceholders).filter(
        reference => reference.source === "ENV"
      );
      const results = await Promise.allSettled(
        references.map(reference => {
          const envVarId = idOf(envVars.data?.data.find(item => item.key === reference.key));
          return envVarId ? injectEnvVar({functionId, envVarId}).unwrap() : Promise.resolve();
        })
      );
      const failed = references.filter((_, index) => results[index].status === "rejected");
      if (failed.length) {
        throw new Error(`Could not attach ${failed.map(reference => reference.key).join(", ")} to the function.`);
      }
    },
    [attachedPlaceholders, envVars.data, injectEnvVar]
  );

  const disabledHint = isForbidden(envVars.error) ? MISSING_PERMISSION_HINT : undefined;

  return {fieldSources: {envVarKeys, attachedPlaceholders, disabledHint}, attach};
}
