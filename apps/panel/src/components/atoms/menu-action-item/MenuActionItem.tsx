import {Icon, FluidContainer, type IconName} from "oziko-ui-kit";
import styles from "./MenuActionItem.module.scss";

interface MenuActionItemProps {
  icon: IconName;
  label: string;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "danger";
}

const MenuActionItem = ({
  icon,
  label,
  onClick,
  className,
  variant = "default"
}: MenuActionItemProps) => {
  const handleClick = () => {
    onClick?.();
  };

  const combinedClassName = `${styles.menuActionItem} ${className || ""}`;

  return (
    <FluidContainer
      prefix={{children: <Icon name={icon} size="sm" />}}
      root={{children: <span>{label}</span>}}
      dimensionX="fill"
      mode="hug"
      className={`${combinedClassName} ${variant === "danger" ? styles.danger : ""}`}
      onClick={handleClick}
    />
  );
};

export default MenuActionItem;
