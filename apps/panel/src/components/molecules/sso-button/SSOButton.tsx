import {
  Icon,
  Text,
  FluidContainer,
  type TypeFluidContainer,
  useOnClickOutside,
  type IconName
} from "oziko-ui-kit";
import React, {type FC, memo, useRef, useState} from "react";
import styles from "./SSOButton.module.scss";

type TypeSSOButton = {
  icon: IconName;
  label: string;
  onClick?: () => void;
} & TypeFluidContainer;

const SSOButton: FC<TypeSSOButton> = ({icon, label, onClick, ...props}) => {
  const [isClicked, setIsClicked] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleClick = () => {
    setIsClicked(true);
    if (onClick) onClick();
  };

  useOnClickOutside({
    targetElements: [containerRef],
    onClickOutside: () => setIsClicked(false)
  });

  return (
    <FluidContainer
      ref={containerRef}
      dimensionX={200}
      alignment="leftCenter"
      mode="fill"
      gap={10}
      prefix={{
        children: <Icon name={icon} size="sm" className={isClicked ? styles.active : ""} />
      }}
      root={{
        children: (
          <Text className={`${styles.text} ${isClicked ? styles.active : ""}`}>{label}</Text>
        ),
        alignment: "leftCenter"
      }}
      suffix={{
        children: isClicked ? <Icon name="check" size="sm" className={styles.active} /> : undefined
      }}
      onClick={handleClick}
      {...props}
      className={` ${props.className} ${styles.ssoButton} ${isClicked ? styles.clicked : ""}`}
    />
  );
};

export default memo(SSOButton);
