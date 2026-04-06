/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import { FlexElement, FluidContainer, Text } from "oziko-ui-kit";

type InfoRowProps = {
  label: string;
  value: React.ReactNode;
  labelWidth?: number;
  valueClassName?: string;
  labelClassName?: string;
  className?: string;
};

export const InfoRow = React.memo<InfoRowProps>(
  ({
    label,
    value,
    labelWidth = 200,
    valueClassName,
    labelClassName,
    className,
  }) => (
    <FluidContainer
      className={className}
      prefix={{
        children: (
          <FlexElement dimensionX={labelWidth} alignment="leftCenter">
            <Text className={labelClassName}>{label}</Text>
          </FlexElement>
        ),
      }}
      root={{
        children: <Text className={valueClassName}>: {value}</Text>,
      }}
    />
  )
);

InfoRow.displayName = "InfoRow";
