/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Drawer, FlexElement, Icon } from "oziko-ui-kit";
import { useGetAuthenticationStrategiesQuery, useDeleteStrategyMutation } from "../../store/api/authenticationStrategyApi";
import type { AuthenticationStrategy } from "../../store/api/authenticationStrategyApi";
import Page from "../../components/organisms/page-layout/Page";
import StrategyList from "./components/StrategyList";
import StrategyForm from "./components/StrategyForm";
import DeleteStrategyConfirmation from "./components/DeleteStrategyConfirmation";
import styles from "./Strategy.module.scss";

const Strategy = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<AuthenticationStrategy | null>(null);
  const [strategyToDelete, setStrategyToDelete] = useState<AuthenticationStrategy | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const { data: strategies, isLoading, error } = useGetAuthenticationStrategiesQuery();
  const [deleteStrategy, { isLoading: isDeleting }] = useDeleteStrategyMutation();

  const handleOpenDrawer = useCallback(() => {
    setSelectedStrategy(null);
    setIsDrawerOpen(true);
  }, []);

  const handleOpenStrategyDrawer = useCallback((strategy: AuthenticationStrategy) => {
    setSelectedStrategy(strategy);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedStrategy(null);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const requestedStrategyId = searchParams.get("id");
  useEffect(() => {
    const requested = strategies?.find((strategy) => strategy._id === requestedStrategyId);
    if (requested) {
      setSelectedStrategy(requested);
      setIsDrawerOpen(true);
    }
  }, [requestedStrategyId, strategies]);

  const handleDeleteClick = useCallback((e: React.MouseEvent, strategy: AuthenticationStrategy) => {
    e.stopPropagation();
    setStrategyToDelete(strategy);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!strategyToDelete) return;
    try {
      await deleteStrategy(strategyToDelete._id).unwrap();
      setStrategyToDelete(null);
    } catch {
      // Error handled by mutation
    }
  }, [strategyToDelete, deleteStrategy]);

  const handleCancelDelete = useCallback(() => setStrategyToDelete(null), []);

  return (
    <Page title="AVAILABLE STRATEGIES">
      <FlexElement
        dimensionX="fill"
        direction="horizontal"
        alignment="leftTop"
        gap={0}
        className={styles.strategyContainer}
      >
        <Button className={styles.addStrategyButton} onClick={handleOpenDrawer}>
          <Icon name="plus" /> Add New Strategy
        </Button>
        <StrategyList
          strategies={strategies}
          isLoading={isLoading}
          error={error}
          onSelectStrategy={handleOpenStrategyDrawer}
          onDeleteClick={handleDeleteClick}
        />
      </FlexElement>

      <Drawer
        placement="right"
        size={600}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        showCloseButton={false}
      >
        <StrategyForm
          isOpen={isDrawerOpen}
          selectedStrategy={selectedStrategy}
          onClose={handleCloseDrawer}
        />
      </Drawer>

      {strategyToDelete && (
        <DeleteStrategyConfirmation
          strategy={strategyToDelete}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          isLoading={isDeleting}
        />
      )}
    </Page>
  );
};

export default Strategy;
