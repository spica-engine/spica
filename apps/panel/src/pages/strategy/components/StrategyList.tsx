/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { memo } from "react";
import { FlexElement, Text } from "oziko-ui-kit";
import type { AuthenticationStrategy } from "../../../store/api/authenticationStrategyApi";
import StrategyItem from "./StrategyItem";
import styles from "./StrategyList.module.scss";

type StrategyListProps = {
  strategies: AuthenticationStrategy[] | undefined;
  isLoading: boolean;
  error: unknown;
  onSelectStrategy: (strategy: AuthenticationStrategy) => void;
  onDeleteClick: (e: React.MouseEvent, strategy: AuthenticationStrategy) => void;
};

const StrategyList = memo(function StrategyList({
  strategies,
  isLoading,
  error,
  onSelectStrategy,
  onDeleteClick
}: StrategyListProps) {
  if (isLoading) {
    return (
      <>
        {Array.from({ length: 3 }).map((_, index) => (
          <FlexElement
            key={index}
            dimensionX="fill"
            direction="horizontal"
            className={styles.skeletonStrategyItem}
          >
            {" "}
          </FlexElement>
        ))}
      </>
    );
  }

  if (error) {
    return <Text variant="danger">Error loading strategies. Please try again.</Text>;
  }

  if (!strategies || strategies.length === 0) {
    return <Text>No strategies available.</Text>;
  }

  return (
    <>
      {strategies.map(strategy => (
        <StrategyItem
          key={strategy._id}
          strategy={strategy}
          onSelect={onSelectStrategy}
          onDelete={onDeleteClick}
        />
      ))}
    </>
  );
});

export default StrategyList;
