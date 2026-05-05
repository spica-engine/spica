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
} from "../../store/api/policyApi";
import { Button, FlexElement, Icon, type TableColumn } from "oziko-ui-kit";
import SpicaTable from "../../components/organisms/table/Table";
import styles from "./Policy.module.scss";
import PolicyDrawer, { type PolicyUpsertInput } from "./PolicyDrawer";
import { registerAllRenderers } from "./registerRenderers";
import { useModuleDataRegistry } from "./moduleRenderers";
import { useModuleStatements } from "./hook/useStatement";
import Confirmation from "../../components/molecules/confirmation/Confirmation";

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
  
  const modules = useModuleStatements(statements ?? []);
  const { moduleData, moduleDataElements } = useModuleDataRegistry();


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

  const columns: TableColumn<PolicyItem>[] = useMemo(() => {
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
    <FlexElement
      dimensionX="fill"
      direction="vertical"
      gap={10}
      className={styles.policyContainer}
    >
      <FlexElement
        dimensionX="fill"
        alignment="rightCenter"
        direction="horizontal"
        gap={10}
      >
        <Button onClick={openCreatePolicy}>
          <Icon name="plus" />
          Add Policy
        </Button>
      </FlexElement>

      {moduleDataElements}
      <SpicaTable data={policies ?? []} columns={columns} isLoading={isLoading} skeletonRowCount={10}/>

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
    </FlexElement>
  );
};

export default Policy;
