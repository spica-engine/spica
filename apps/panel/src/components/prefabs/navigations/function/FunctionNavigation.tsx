/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";
import {Button, FluidContainer, Icon, Text} from "oziko-ui-kit";
import styles from "../Navigation.module.scss";
import {
  useGetFunctionsQuery,
  useUpdateFunctionOrderMutation,
  useDeleteFunctionMutation
} from "../../../../store/api";
import type {SpicaFunction} from "../../../../store/api/functionApi";
import SortableNavigationItem from "../SortableNavigationItem";
import AddFunctionModal from "./AddFunctionModal";
import Confirmation from "../../../molecules/confirmation/Confirmation";

const FUNCTION_ITEM_TYPE = "FUNCTION_NAVIGATION_ITEM";
const FUNCTION_GROUP_KEY = "__functions__";

const FunctionNavigation = () => {
  const navigate = useNavigate();
  const {data: functions} = useGetFunctionsQuery();
  const [updateFunctionOrder] = useUpdateFunctionOrderMutation();
  const [deleteFunction, {isLoading: isDeleting}] = useDeleteFunctionMutation();
  const [orderedFunctions, setOrderedFunctions] = useState<SpicaFunction[]>([]);
  const previousFunctionsRef = useRef<SpicaFunction[] | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingFunction, setDeletingFunction] = useState<SpicaFunction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const functionList = Array.isArray(functions) ? functions : functions?.data;

  const sortedFunctions = useMemo(() => {
    if (!Array.isArray(functionList)) {
      return [];
    }

    return [...functionList].sort((a, b) => {
      const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return a.name.localeCompare(b.name);
    });
  }, [functionList]);

  useEffect(() => {
    setOrderedFunctions(sortedFunctions);
  }, [sortedFunctions]);

  const moveFunction = useCallback((fromIndex: number, toIndex: number) => {
    setOrderedFunctions(prev => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);

      if (!moved) {
        return prev;
      }

      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const handleNavigateToFunction = useCallback(
    (functionId: string) => {
      navigate(`/function/${functionId}`);
    },
    [navigate]
  );

  const handleFunctionCreated = useCallback(
    (fn: SpicaFunction) => {
      if (fn._id) navigate(`/function/${fn._id}`);
    },
    [navigate]
  );

  const handleDeleteClick = useCallback((e: React.MouseEvent, fn: SpicaFunction) => {
    e.stopPropagation();
    setDeleteError(null);
    setDeletingFunction(fn);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingFunction?._id) return;
    try {
      await deleteFunction(deletingFunction._id).unwrap();
      setDeletingFunction(null);
    } catch (err: any) {
      setDeleteError(err?.data?.message ?? err?.message ?? "Failed to delete function.");
    }
  }, [deletingFunction, deleteFunction]);

  const handleDeleteCancel = useCallback(() => {
    setDeletingFunction(null);
    setDeleteError(null);
  }, []);

  const handleDragStart = useCallback(
    (startIndex: number) => {
      if (!orderedFunctions[startIndex]) {
        previousFunctionsRef.current = null;
        return;
      }

      previousFunctionsRef.current = orderedFunctions.map(fn => ({...fn}));
    },
    [orderedFunctions]
  );

  const handleDropFunction = useCallback(
    async (functionId: string, finalIndex: number) => {
      const snapshot =
        previousFunctionsRef.current?.map(fn => ({...fn})) ?? orderedFunctions.map(fn => ({...fn}));

      const reordered = (() => {
        const next = orderedFunctions.map(fn => ({...fn}));
        const currentIndex = next.findIndex(fn => fn._id === functionId);

        if (currentIndex === -1) {
          return next;
        }

        const [moved] = next.splice(currentIndex, 1);
        next.splice(finalIndex, 0, moved);

        return next.map((fn, i) => ({...fn, order: i}));
      })();

      setOrderedFunctions(reordered);

      try {
        await Promise.all(
          reordered.map(fn =>
            updateFunctionOrder({functionId: fn._id!, order: fn.order ?? 0}).unwrap()
          )
        );
      } catch (error) {
        console.error("Failed to update function order", error);
        setOrderedFunctions(snapshot);
      } finally {
        previousFunctionsRef.current = null;
      }
    },
    [orderedFunctions, updateFunctionOrder]
  );

  const handleNavigateToLogs = useCallback(() => {
    navigate("/function-logs");
  }, [navigate]);

  return (
    <div className={styles.container}>
      <FluidContainer
        dimensionX={"fill"}
        mode="fill"
        className={styles.header}
        root={{
          children: (
            <Text dimensionX="fill" size="large">
              Functions
            </Text>
          )
        }}
        suffix={{
          children: (
            <Button variant="icon" color="transparent" className={styles.button} onClick={handleNavigateToLogs}>
              <Icon name="cog" size="sm" />
            </Button>
          )
        }}
      />
      {orderedFunctions.map((fn, index) => (
        <SortableNavigationItem
          key={fn._id ?? index}
          id={fn._id!}
          title={fn.name}
          index={index}
          groupKey={FUNCTION_GROUP_KEY}
          dndType={FUNCTION_ITEM_TYPE}
          iconName="function"
          moveItem={moveFunction}
          onNavigate={handleNavigateToFunction}
          onDragStart={handleDragStart}
          onDrop={handleDropFunction}
          itemClassName={styles.defaultNavigationItem}
          renderSuffix={dragHandleRef => (
            <>
              <Button
                variant="icon"
                color="transparent"
                className={styles.button}
                onClick={e => handleDeleteClick(e, fn)}
              >
                <Icon name="delete" size="sm" />
              </Button>
              <div ref={dragHandleRef}>
                <Button variant="icon" color="transparent" className={styles.button}>
                  <Icon name="dragHorizontalVariant" size="sm" />
                </Button>
              </div>
            </>
          )}
        />
      ))}
      <div className={styles.addFunctionButtonContainer}>
        <Button variant="outlined" color="default" fullWidth onClick={() => setIsModalOpen(true)} className={styles.addFunctionButton}>
          <Icon name="plus" size="sm" />
          Add New Function
        </Button>
      </div>

      <AddFunctionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleFunctionCreated}
      />
      {deletingFunction && (
        <Confirmation
          title="DELETE FUNCTION"
          description={
            <>
              This action will permanently delete this function and all its code, triggers,
              dependencies, and logs. This cannot be undone.
              {"\n\n"}
              Please type <strong>{deletingFunction.name}</strong> to confirm deletion.
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
          confirmCondition={val => val === deletingFunction.name}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          loading={isDeleting}
          error={deleteError}
        />
      )}
    </div>
  );
};

export default memo(FunctionNavigation);
