/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  useGetPoliciesQuery,
  useCreatePolicyMutation,
  useUpdatePolicyMutation,
  useDeletePolicyMutation,
  useGetStatementsQuery,
  type Policy as PolicyType,
} from "../../store/api/policyApi";
import { Button, FlexElement, Icon, Table, type TableColumn } from "oziko-ui-kit";
import styles from "./Policy.module.scss";
import bucketStyles from "../bucket/Bucket.module.scss";
import PolicyDrawer, { type PolicyUpsertInput } from "./PolicyDrawer";
import { registerAllRenderers } from "./registerRenderers";
import { useModuleDataRegistry } from "./moduleRenderers";
import { useModuleStatements } from "./hook/useStatement";
import Confirmation from "../../components/molecules/confirmation/Confirmation";
import PolicyActionBar from "../../components/molecules/policy-action-bar/PolicyActionBar";

registerAllRenderers();


export type PolicyItem = {
  _id: string;
  name: string;
  description: string;
  statement: { action: string; module: string; resource?: { include: string[]; exclude: string[] } }[];
  system?: boolean;
};

const Policy = () => {
  const { data: policies, isLoading } = useGetPoliciesQuery();

  const {data: statements} = useGetStatementsQuery();
  const [createPolicy] = useCreatePolicyMutation();
  const [updatePolicy] = useUpdatePolicyMutation();
  const [deletePolicy] = useDeletePolicyMutation();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyItem | null>(null);
  const [policyToDelete, setPolicyToDelete] = useState<PolicyItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedFilter, setAppliedFilter] = useState<Record<string, any> | null>(null);
  
  const modules = useModuleStatements(statements ?? []);
  const { moduleData, moduleDataElements } = useModuleDataRegistry();

  const filteredPolicies = useMemo(() => {
    let list = policies ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p._id?.toLowerCase().includes(q)
      );
    }
    if (appliedFilter) {
      const filterEntries = Object.entries(appliedFilter);
      list = list.filter((p: any) =>
        filterEntries.every(([key, val]) => {
          if (val === null || val === undefined) return true;
          const itemVal = p[key];
          if (typeof val === "string") return String(itemVal ?? "").toLowerCase().includes(val.toLowerCase());
          return itemVal === val;
        })
      );
    }
    return list;
  }, [policies, searchQuery, appliedFilter]);


  const openCreatePolicy = useCallback(() => {
    setSelectedPolicy(null);
    setIsOpen(true);
  }, []);

  const openCreateFromPredefined = useCallback((policy: PolicyItem) => {
    setSelectedPolicy({ ...policy, _id: "" });
    setIsOpen(true);
  }, []);

  const openEditPolicy = useCallback((policy: PolicyItem) => {
    setSelectedPolicy(policy);
    setIsOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsOpen(false);
    setSelectedPolicy(null);
  }, []);

  const handleSave = useCallback(async (input: PolicyUpsertInput) => {
    try {
      if (selectedPolicy?._id) {
        await updatePolicy({
          id: selectedPolicy._id,
          body: {
            name: input.name,
            description: input.description,
            statement: input.statement,
          },
        }).unwrap();
      } else {
        await createPolicy({
          name: input.name,
          description: input.description,
          statement: input.statement || [],
        }).unwrap();
      }
      handleCloseDrawer();
    } catch (error) {
      console.error("Failed to save policy:", error);
      alert("Failed to save policy. Please try again.");
    }
  }, [createPolicy, handleCloseDrawer, selectedPolicy, updatePolicy]);

  const handleDeleteClick = useCallback((policy: PolicyItem) => {
    setPolicyToDelete(policy);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!policyToDelete) return;
    try {
      await deletePolicy(policyToDelete._id).unwrap();
      setPolicyToDelete(null);
    } catch (error) {
      console.error("Failed to delete policy:", error);
      setPolicyToDelete(null);
    }
  }, [deletePolicy, policyToDelete]);

  const handleCancelDelete = useCallback(() => {
    setPolicyToDelete(null);
  }, []);

  const columns: TableColumn<PolicyType>[] = useMemo(() => {
    return [
      {
        header: <FlexElement>#</FlexElement>,
        key: "_id",
        renderCell: ({ row }) => <span>{row._id}</span>
      },
      {
        header: <FlexElement>Name</FlexElement>,
        key: "name",
        renderCell: ({ row }) => <span>{row.name}</span>
      },
      {
        header: <FlexElement>Description</FlexElement>,
        key: "description",
        renderCell: ({ row }) => <span>{row.description}</span>
      },
      {
        header: (
          <FlexElement dimensionX="fill" alignment="rightCenter" direction="horizontal">
            Actions
          </FlexElement>
        ),
        key: "actions",
        width: "100px",
        minWidth: "100px",
        renderCell: ({ row }) => (
          <FlexElement dimensionX="fill" alignment="rightCenter" direction="horizontal">
            {row.system ? (
              <>
                <span title="Create new from this predefined policy">
                  <Button
                    variant="icon"
                    color="default"
                    className={styles.actionButton}
                    onClick={() => openCreateFromPredefined(row)}
                  >
                    <Icon name="layers" />
                  </Button>
                </span>
                <span title="You can't edit predefined policies">
                  <Button
                    variant="icon"
                    color="default"
                    className={styles.actionButton}
                    onClick={() => {}}
                  >
                    <Icon name="lock" />
                  </Button>
                </span>
              </>
            ) : (
              <>
                <Button
                  variant="icon"
                  color="default"
                  className={styles.actionButton}
                  onClick={() => openEditPolicy(row)}
                >
                  <Icon name="pencil" />
                </Button>
                <Button
                  variant="icon"
                  color="danger"
                  className={styles.actionButton}
                  onClick={() => handleDeleteClick(row)}
                >
                  <Icon name="delete" />
                </Button>
              </>
            )}
          </FlexElement>
        )
      }
    ];
  }, [handleDeleteClick, openCreateFromPredefined, openEditPolicy]);

  return (
    <div className={bucketStyles.container}>
      <PolicyActionBar
        onSearch={setSearchQuery}
        onAddPolicy={openCreatePolicy}
        onFilter={setAppliedFilter}
      />

      {moduleDataElements}
      <Table
        data={filteredPolicies}
        columns={columns}
        loading={isLoading}
        skeletonRowCount={10}
        emptyState={{
          title: "No policies found",
          description: "There are no policies yet. Create one to get started.",
          actions: (
            <Button onClick={openCreatePolicy}>
              <Icon name="plus" size={14} />
              Add Policy
            </Button>
          ),
        }}
      />

      <PolicyDrawer
        isOpen={isOpen}
        selectedPolicy={selectedPolicy}
        modules={modules}
        moduleData={moduleData}
        onSave={handleSave}
        onCancel={handleCloseDrawer}
      />

      {policyToDelete && (
        <Confirmation
          title="DELETE POLICY"
          description={
            <>
              <span>
                This action will permanently delete this policy and remove all associated permissions.
                This cannot be undone.
              </span>
              <span>
                Please type <strong>{policyToDelete.name}</strong> to confirm deletion.
              </span>
            </>
          }
          inputPlaceholder="Type Here"
          confirmCondition={(input) => input === policyToDelete.name}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          confirmLabel={<><Icon name="delete" /> Delete</>}
          cancelLabel={<><Icon name="close" /> Cancel</>}
          showInput
        />
      )}
    </div>
  );
};

export default Policy;
