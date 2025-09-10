import MenuGroup from "src/components/organisms/menu-group/MenuGroup";
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
          value: <MenuActionItem icon="pencil" label="Edit" onClick={onEdit} />,
          className: styles.groupContainer
        },
        actions: {
          value: (
            <>
              <MenuActionItem icon="chevronRight" label="Move Right" onClick={onMoveRight} />
              <MenuActionItem icon="chevronLeft" label="Move Left" onClick={onMoveLeft} />
              <MenuActionItem icon="chevronDown" label="Sort By Asc" onClick={onSortAsc} />
              <MenuActionItem icon="chevronDown" label="Sort By Desc" onClick={onSortDesc} />
            </>
          ),
          className: styles.groupContainer
        },
        delete: {
          value: (
            <MenuActionItem icon="delete" label="Delete" onClick={onDelete} variant="danger" />
          ),
          className: styles.groupContainer
        }
      }}
      className={styles.container}
    />
  );
};

export default ColumnActionsMenu;
