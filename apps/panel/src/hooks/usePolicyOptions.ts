import { useMemo } from "react";
import { useGetPoliciesQuery } from "../store/api/policyApi";

export function usePolicyOptions() {
  const { data: policies } = useGetPoliciesQuery();

  return useMemo(() => {
    const list = policies ?? [];
    const nameCounts = new Map<string, number>();
    list.forEach((p) => nameCounts.set(p.name, (nameCounts.get(p.name) ?? 0) + 1));

    const labelById = new Map<string, string>();
    const idByLabel = new Map<string, string>();
    list.forEach((p) => {
      const label = nameCounts.get(p.name)! > 1 ? `${p.name} (${p._id})` : p.name;
      labelById.set(p._id, label);
      idByLabel.set(label, p._id);
    });

    return {
      policyOptions: list.map((p) => p._id),
      policyLabels: list.map((p) => labelById.get(p._id)!),
      idsToLabels: (ids: string[]) => ids.map((id) => labelById.get(id) ?? id),
      labelsToIds: (labels: string[]) => labels.map((label) => idByLabel.get(label) ?? label),
    };
  }, [policies]);
}
