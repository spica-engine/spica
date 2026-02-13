/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { memo } from "react";
import { Button, FluidContainer, Icon, Text, type IconName } from "oziko-ui-kit";
import type { AuthenticationStrategy } from "../../../store/api/authenticationStrategyApi";
import styles from "./StrategyItem.module.scss";

type StrategyItemProps = {
  strategy: AuthenticationStrategy;
  onSelect: (strategy: AuthenticationStrategy) => void;
  onDelete: (e: React.MouseEvent, strategy: AuthenticationStrategy) => void;
};

const StrategyItem = memo(function StrategyItem({
  strategy,
  onSelect,
  onDelete
}: StrategyItemProps) {
  return (
    <FluidContainer
      mode="fill"
      alignment="center"
      className={styles.strategyItem}
      onClick={() => onSelect(strategy)}
      prefix={{
        children: <Icon name={strategy.icon as IconName} />
      }}
      root={{
        children: <Text>{strategy.title || strategy.name}</Text>,
        className: styles.strategyItemText,
        alignment: "leftCenter"
      }}
      suffix={{
        children: (
          <Button
            variant="icon"
            color="danger"
            onClick={e => onDelete(e, strategy)}
            className={styles.deleteButton}
          >
            <Icon name="delete" />
          </Button>
        )
      }}
    />
  );
});

export default StrategyItem;
