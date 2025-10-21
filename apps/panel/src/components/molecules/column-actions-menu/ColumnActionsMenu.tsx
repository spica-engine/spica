
import { MenuGroup } from "oziko-ui-kit";
import MenuActionItem from "../../atoms/menu-action-item/MenuActionItem";
import styles from "./ColumnActionsMenu.module.scss";

interface ColumnActionsMenuProps {
  onEdit?: () => void;
  onMoveRight?: () => void;
  onMoveLeft?: () => void;
  onSortAsc?: () => void;
  onSortDesc?: () => void;
  onDelete?: () => void;
  className?: string;
}

const ColumnActionsMenu = ({
  onEdit,
  onMoveRight,
  onMoveLeft,
  onSortAsc,
  onSortDesc,
  onDelete,
  className
}: ColumnActionsMenuProps) => {
  return (
    <MenuGroup
      options={{
        edit: {
          value: onEdit && <MenuActionItem icon="pencil" label="Edit" onClick={onEdit} />,
          className: `${!onEdit ? `${styles.noPadding} ${styles.noBottomBorder}` : undefined} ${styles.groupContainer}`
        },
        actions: {
          value: (
            <>
              {onMoveRight && <MenuActionItem icon="chevronRight" label="Move Right" onClick={onMoveRight} />}
              {onMoveLeft && <MenuActionItem icon="chevronLeft" label="Move Left" onClick={onMoveLeft} />}
              <MenuActionItem icon="chevronDown" label="Sort By Asc" onClick={onSortAsc}/>
              <MenuActionItem icon="chevronDown" label="Sort By Desc" onClick={onSortDesc} />
            </>
          ),
          className: `${!onEdit ? styles.noTopBorder : undefined} ${!onDelete ? styles.noBottomBorder : undefined} ${styles.groupContainer}`
        },
        delete: {
          value: onDelete && (
            <MenuActionItem icon="delete" label="Delete" onClick={onDelete} variant="danger" />
          ),
          className: `${!onEdit ? `${styles.noPadding} ${styles.noTopBorder}` : undefined} ${styles.groupContainer}`
        }
      }}
      className={styles.container}
    />
  );
};

export default ColumnActionsMenu;
