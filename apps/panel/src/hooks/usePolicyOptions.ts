import { useMemo } from "react";
import type { TypeRepresenterValue } from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import { useGetPoliciesQuery } from "../store/api/policyApi";
import { idOf } from "../utils/recordKey";

export function usePolicyOptions() {
  const { data: policies } = useGetPoliciesQuery();

  return useMemo(() => {
    const list = policies ?? [];
    const nameCounts = new Map<string, number>();
    list.forEach((p) => nameCounts.set(p.name, (nameCounts.get(p.name) ?? 0) + 1));

    const labelById = new Map<string, string>();
    const idByLabel = new Map<string, string>();
    list.forEach((p) => {
      const label = nameCounts.get(p.name)! > 1 ? `${p.name} (${idOf(p)})` : p.name;
      labelById.set(idOf(p)!, label);
      idByLabel.set(label, idOf(p)!);
    });

    const idsToLabels = (ids: string[]) => ids.map((id) => labelById.get(id) ?? id);
    const labelsToIds = (labels: string[]) => labels.map((label) => idByLabel.get(label) ?? label);

    return {
      policyOptions: list.map((p) => idOf(p)!),
      policyLabels: list.map((p) => labelById.get(idOf(p)!)!),
      toInputValues: (values: TypeRepresenterValue) => ({
        ...values,
        policies: idsToLabels((values.policies as string[]) ?? []),
      }),
      fromInputChange: ({ policies, ...rest }: TypeRepresenterValue) => ({
        ...rest,
        ...(policies !== undefined && { policies: labelsToIds(policies as string[]) }),
      }),
    };
  }, [policies]);
}
