import {Button, FlexElement, Icon, Popover, Text} from "oziko-ui-kit";
import {memo, useRef, useState, type FC} from "react";
import styles from "./FunctionNavigatorPopup.module.scss";
import Confirmation from "../confirmation/Confirmation";
import CategorySelectCreate from "../category-select-create/CategorySelectCreate";
import {
  useGetFunctionsQuery,
  useChangeFunctionCategoryMutation,
  useRenameFunctionMutation,
  useDeleteFunctionMutation
} from "../../../store/api";
import type {SpicaFunction} from "../../../store/api/functionApi";
import type {BucketType} from "../../../store/api/bucketApi";
import EditFunction from "../../prefabs/edit-function/EditFunction";

export type FunctionNavigatorPopupProps = {
  className?: string;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fn: SpicaFunction;
};

const FunctionNavigatorPopup: FC<FunctionNavigatorPopupProps> = ({className, isOpen, setIsOpen, fn}) => {
  const containerRef = useRef(null);
  const [isCategorySelectOpen, setIsCategorySelectOpen] = useState(false);
  const [isDeletingOpen, setIsDeletingOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {data: functions = []} = useGetFunctionsQuery();
  const [changeFunctionCategory] = useChangeFunctionCategoryMutation();
  const [deleteFunction, {isLoading: isDeleting}] = useDeleteFunctionMutation();

  const functionList = Array.isArray(functions) ? functions : (functions as any)?.data ?? [];
  const functionCategories = Array.from(
    new Set(functionList.map((f: SpicaFunction) => f.category).filter(Boolean))
  ) as string[];

  // Adapt SpicaFunction to BucketType shape so CategorySelectCreate can be reused
  const fnAsBucket = {_id: fn._id!, title: fn.name} as BucketType;

  const handleChangeCategory = async (id: string, category: string) => {
    return changeFunctionCategory({functionId: id, category});
  };

  const handleOpenCategorySelect = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsCategorySelectOpen(true);
  };

  const handleCancelCategorySelect = () => {
    setIsCategorySelectOpen(false);
    setIsOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!fn._id) return;
    try {
      await deleteFunction(fn._id).unwrap();
      setIsDeletingOpen(false);
    } catch (err: any) {
      setDeleteError(err?.data?.message ?? err?.message ?? "Failed to delete function.");
    }
  };

  const handleDeleteCancel = () => {
    setIsDeletingOpen(false);
    setDeleteError(null);
  };

  return (
    <div ref={containerRef} className={`${styles.container} ${className || ""}`}>
      <Popover
        open={isOpen}
        contentProps={{className: styles.popoverContainer}}
        onClose={() => setIsOpen(false)}
        content={
          <FlexElement
            dimensionX={160}
            direction="vertical"
            className={styles.popoverContent}
          >
            <Button
              containerProps={{alignment: "leftCenter", dimensionX: "fill"}}
              color="default"
              onClick={handleOpenCategorySelect}
              className={styles.buttons}
            >
              <Icon name="plus" />
              <Text>Add to category</Text>
            </Button>
            <EditFunction fn={fn}>
              {({onOpen}) => (
                <Button
                  containerProps={{alignment: "leftCenter", dimensionX: "fill"}}
                  color="default"
                  onClick={onOpen}
                  className={styles.buttons}
                >
                  <Icon name="pencil" />
                  <Text>Edit</Text>
                </Button>
              )}
            </EditFunction>
            <Button
              containerProps={{alignment: "leftCenter", dimensionX: "fill"}}
              color="default"
              onClick={e => {
                e.stopPropagation();
                setIsOpen(false);
                setDeleteError(null);
                setIsDeletingOpen(true);
              }}
              className={styles.buttons}
            >
              <Icon name="delete" className={styles.deleteIcon} />
              <Text variant="danger">Delete</Text>
            </Button>
          </FlexElement>
        }
      >
        <Button
          onClick={e => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          color="transparent"
          variant="icon"
          className={styles.itemButton}
        >
          <Icon name="dotsVertical" size="sm" />
        </Button>
      </Popover>

      {isCategorySelectOpen && (
        <CategorySelectCreate
          changeCategory={handleChangeCategory}
          bucket={fnAsBucket}
          categories={functionCategories}
          onCancel={handleCancelCategorySelect}
        />
      )}

      {isDeletingOpen && (
        <Confirmation
          title="DELETE FUNCTION"
          description={
            <>
              This action will permanently delete this function and all its code, triggers,
              dependencies, and logs. This cannot be undone.
              {"\n\n"}
              Please type <strong>{fn.name}</strong> to confirm deletion.
            </>
          }
          inputPlaceholder="Type function name"
          confirmLabel={
            <>
              <Icon name="delete" />
              Delete
            </>
          }
          cancelLabel={
            <>
              <Icon name="close" />
              Cancel
            </>
          }
          showInput
          confirmCondition={val => val === fn.name}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          loading={isDeleting}
          error={deleteError}
        />
      )}
    </div>
  );
};

export default memo(FunctionNavigatorPopup);
