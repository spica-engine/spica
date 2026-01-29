/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useMemo, useState } from "react";
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
  
  const modules = useModuleStatements(statements ?? []);
  const { moduleData, moduleDataElements } = useModuleDataRegistry();


  const openCreatePolicy = () => {
    setSelectedPolicy(null);
    setIsOpen(true);
  };

  const openEditPolicy = (policy: PolicyItem) => {
    setSelectedPolicy(policy);
    setIsOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsOpen(false);
    setSelectedPolicy(null);
  };

  const handleSave = async (input: PolicyUpsertInput) => {
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
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm("Are you sure you want to delete this policy?")) return;

    try {
      await deletePolicy(policyId).unwrap();
    } catch (error) {
      console.error("Failed to delete policy:", error);
      alert("Failed to delete policy. Please try again.");
    }
  };

  const columns: TableColumn<PolicyItem>[] = useMemo(
    () => [
      {
        header: <FlexElement>#</FlexElement>, 
        key: "_id",
        renderCell: ({ row }) => <span>{row._id}</span>,
      },
      {
        header: <FlexElement>Name</FlexElement>,   
        key: "name",
        renderCell: ({ row }) => <span>{row.name}</span>,
      },
      {
        header: <FlexElement>Description</FlexElement>, 
        key: "description",
        renderCell: ({ row }) => <span>{row.description}</span>,
      },
      {
        header: <FlexElement dimensionX="fill" alignment="rightCenter" direction="horizontal">Actions</FlexElement>,
        key: "actions",
        width: '100px',
        minWidth: '100px',
        renderCell: ({ row }) => (
          <FlexElement
            dimensionX="fill"
            alignment="rightCenter"
            direction="horizontal"
          >
            <Button
              variant="icon"
              color="default"
              className={styles.actionButton}
              onClick={() => openEditPolicy(row)}
            >
              <Icon name="layers" />
            </Button>
            <Button
              variant="icon"
              color="danger"
              className={styles.actionButton}
              onClick={() => handleDeletePolicy(row._id)}
              disabled={row.system}
            >
              <Icon name="lock" />
            </Button>
          </FlexElement>
        ),
      },
    ],
    []
  );

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
    </FlexElement>
  );
};

export default Policy;
