/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useEffect, useMemo, useRef, useState, type FC, type ReactNode} from "react";
import {useNavigate} from "react-router-dom";
import {Accordion, Button, FlexElement, FluidContainer, Icon, Input, Modal, Popover, Text, helperUtils} from "oziko-ui-kit";
import styles from "../Navigation.module.scss";
import functionNavigationStyles from "./FunctionNavigation.module.scss";
import {
  useGetFunctionsQuery,
  useUpdateFunctionOrderMutation,
  useChangeFunctionCategoryMutation
} from "../../../../store/api";
import type {SpicaFunction} from "../../../../store/api/functionApi";
import SortableNavigationItem, {shouldPreventHover} from "../SortableNavigationItem";
import AddFunctionModal from "./AddFunctionModal";
import FunctionNavigatorPopup from "../../../molecules/function-navigator-popup/FunctionNavigatorPopup";
import Confirmation from "../../../molecules/confirmation/Confirmation";
import {useDrag, useDrop} from "react-dnd";
import type {Identifier} from "dnd-core";
import type {SetStateAction} from "react";

const FUNCTION_ITEM_TYPE = "FUNCTION_NAVIGATION_ITEM";
const CATEGORY_ITEM_TYPE = "FUNCTION_NAVIGATION_CATEGORY";
const CATEGORY_ORDER_STORAGE_KEY = "functionNavigationCategoryOrder";
const UNGROUPED_CATEGORY_KEY = "__ungrouped__";

type FunctionWithIndex = {
  fn: SpicaFunction;
  index: number;
};

type CategoryGroup = {
  category: string;
  items: FunctionWithIndex[];
};

type CategoryDragItem = {
  id: string;
  index: number;
  type: typeof CATEGORY_ITEM_TYPE;
};

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((item, i) => item === b[i]);

const safeReadCategoryOrder = (): string[] => {
  if (typeof globalThis === "undefined") return [];
  try {
    const stored = globalThis?.localStorage?.getItem(CATEGORY_ORDER_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const persistCategoryOrder = (order: string[]) => {
  if (typeof globalThis === "undefined") return;
  if (!order.length) {
    globalThis?.localStorage?.removeItem(CATEGORY_ORDER_STORAGE_KEY);
    return;
  }
  globalThis?.localStorage?.setItem(CATEGORY_ORDER_STORAGE_KEY, JSON.stringify(order));
};

const groupFunctionsByCategory = (items: SpicaFunction[]) => {
  const groupedMap = new Map<string, FunctionWithIndex[]>();
  const ungrouped: FunctionWithIndex[] = [];

  for (const [index, fn] of items.entries()) {
    if (fn.category) {
      if (!groupedMap.has(fn.category)) {
        groupedMap.set(fn.category, []);
      }
      groupedMap.get(fn.category)!.push({fn, index});
    } else {
      ungrouped.push({fn, index});
    }
  }

  const grouped: CategoryGroup[] = Array.from(groupedMap.entries()).map(([category, categoryItems]) => ({
    category,
    items: categoryItems
  }));

  return {grouped, ungrouped};
};

type SortableCategoryItemProps = {
  categoryKey: string;
  index: number;
  moveCategory: (fromIndex: number, toIndex: number) => void;
  children: (options: {setDragHandleRef: (node: HTMLDivElement | null) => void}) => ReactNode;
};

const SortableCategoryItem: FC<SortableCategoryItemProps> = ({categoryKey, index, moveCategory, children}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const indexRef = useRef(index);
  indexRef.current = index;

  const [{handlerId}, drop] = useDrop<CategoryDragItem, void, {handlerId: Identifier | null}>({
    accept: CATEGORY_ITEM_TYPE,
    collect: monitor => ({handlerId: monitor.getHandlerId()}),
    hover: (item, monitor) => {
      const dragIndex = item.index;
      const hoverIndex = indexRef.current;
      if (shouldPreventHover(containerRef, dragIndex, hoverIndex, monitor)) return;
      moveCategory(dragIndex, hoverIndex);
      item.index = hoverIndex;
    }
  });

  const [{isDragging}, drag, dragPreview] = useDrag(() => ({
    type: CATEGORY_ITEM_TYPE,
    item: () => ({id: categoryKey, index: indexRef.current, type: CATEGORY_ITEM_TYPE}),
    collect: monitor => ({isDragging: monitor.isDragging()})
  }));

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (node) {
        drop(node);
        dragPreview(node.querySelector("& > div > div > div"));
      }
    },
    [drop, dragPreview, isDragging]
  );

  const setDragHandleRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) drag(node);
    },
    [drag]
  );

  return (
    <div
      ref={setContainerRef}
      data-handler-id={handlerId ?? undefined}
      style={{opacity: isDragging ? 0.4 : 1}}
      className={functionNavigationStyles.categoryItem}
    >
      {children({setDragHandleRef})}
    </div>
  );
};

type CategoryNavigatorPopupProps = {
  categoryName: string;
  isOpen: boolean;
  setIsOpen: (state: SetStateAction<boolean>) => void;
  onRename: (newName: string) => Promise<void>;
  onDelete: () => Promise<void>;
};

const CategoryNavigatorPopup: FC<CategoryNavigatorPopupProps> = ({
  categoryName,
  isOpen,
  setIsOpen,
  onRename,
  onDelete
}) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editValue, setEditValue] = useState(categoryName);
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleOpenEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(categoryName);
    setEditError("");
    setIsOpen(false);
    setIsEditOpen(true);
  };

  const handleOpenDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteError(null);
    setIsOpen(false);
    setIsDeleteOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editValue.trim()) {
      setEditError("Category name cannot be empty.");
      return;
    }
    setEditLoading(true);
    setEditError("");
    try {
      await onRename(editValue.trim());
      setIsEditOpen(false);
    } catch (err: any) {
      setEditError(err?.data?.message ?? err?.message ?? "Failed to rename category.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await onDelete();
      setIsDeleteOpen(false);
    } catch (err: any) {
      setDeleteError(err?.data?.message ?? err?.message ?? "Failed to delete category.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className={functionNavigationStyles.categoryPopupContainer}>
      <Popover
        open={isOpen}
        contentProps={{className: functionNavigationStyles.categoryPopoverContainer}}
        onClose={() => setIsOpen(false)}
        content={
          <FlexElement
            dimensionX={160}
            direction="vertical"
            className={functionNavigationStyles.categoryPopoverContent}
          >
            <Button
              containerProps={{alignment: "leftCenter", dimensionX: "fill"}}
              color="default"
              onClick={handleOpenEdit}
              className={functionNavigationStyles.categoryPopoverButton}
            >
              <Icon name="pencil" />
              <Text>Edit category</Text>
            </Button>
            <Button
              containerProps={{alignment: "leftCenter", dimensionX: "fill"}}
              color="default"
              onClick={handleOpenDelete}
              className={functionNavigationStyles.categoryPopoverButton}
            >
              <Icon name="delete" className={functionNavigationStyles.deleteCategoryIcon} />
              <Text variant="danger">Delete category</Text>
            </Button>
          </FlexElement>
        }
      >
        <Button
          onClick={e => {
            e.stopPropagation();
            setIsOpen(prev => !prev);
          }}
          color="transparent"
          variant="icon"
        >
          <Icon name="dotsVertical" size="sm" />
        </Button>
      </Popover>

      {isEditOpen && (
        <Modal
          showCloseButton={false}
          onClose={() => setIsEditOpen(false)}
          className={functionNavigationStyles.categoryEditModal}
          isOpen
          onClick={e => e.stopPropagation()}
        >
          <div className={functionNavigationStyles.categoryEditContainer}>
            <div className={functionNavigationStyles.categoryEditHeader}>
              <Text className={functionNavigationStyles.categoryEditHeaderText}>EDIT CATEGORY</Text>
            </div>
            <div className={functionNavigationStyles.categoryEditBody}>
              <div className={functionNavigationStyles.categoryEditInputContainer}>
                <Icon name="formatQuoteClose" size="md" />
                <Input
                  className={functionNavigationStyles.categoryEditInput}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  placeholder="Category name"
                />
              </div>
              {editError && (
                <Text variant="danger" className={functionNavigationStyles.categoryEditErrorText}>
                  {editError}
                </Text>
              )}
            </div>
            <div className={functionNavigationStyles.categoryEditFooter}>
              <Button onClick={handleSaveEdit} disabled={editLoading} loading={editLoading}>
                <Icon name="save" />
                <Text>Save</Text>
              </Button>
              <Button variant="text" onClick={() => setIsEditOpen(false)} disabled={editLoading}>
                <Icon name="close" />
                <Text>Cancel</Text>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isDeleteOpen && (
        <Confirmation
          title="DELETE CATEGORY"
          description={
            <>
              This will ungroup all functions in <strong>{categoryName}</strong>. The functions
              themselves will not be deleted.
            </>
          }
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
          showInput={false}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setIsDeleteOpen(false);
            setDeleteError(null);
          }}
          loading={deleteLoading}
          error={deleteError}
        />
      )}
    </div>
  );
};

const FunctionNavigation = () => {
  const navigate = useNavigate();
  const {data: functions} = useGetFunctionsQuery();
  const [updateFunctionOrder] = useUpdateFunctionOrderMutation();
  const [changeFunctionCategory] = useChangeFunctionCategoryMutation();
  const [orderedFunctions, setOrderedFunctions] = useState<SpicaFunction[]>([]);
  const previousFunctionsRef = useRef<SpicaFunction[] | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openFunctionId, setOpenFunctionId] = useState<string | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  const functionList = Array.isArray(functions) ? functions : functions?.data;

  const sortedFunctions = useMemo(() => {
    if (!Array.isArray(functionList)) return [];
    return [...functionList].sort((a, b) => {
      const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }, [functionList]);

  useEffect(() => {
    setOrderedFunctions(sortedFunctions);
  }, [sortedFunctions]);

  useEffect(() => {
    const storedOrder = safeReadCategoryOrder();
    if (storedOrder.length) setCategoryOrder(storedOrder);
  }, []);

  const {grouped, ungrouped} = useMemo(() => groupFunctionsByCategory(orderedFunctions), [orderedFunctions]);

  useEffect(() => {
    setCategoryOrder(prevOrder => {
      const groupedNames = grouped.map(g => g.category);
      const filteredPrev = prevOrder.filter(name => groupedNames.includes(name));
      const missing = groupedNames.filter(name => !filteredPrev.includes(name));
      const nextOrder = [...filteredPrev, ...missing];
      if (arraysEqual(prevOrder, nextOrder)) return prevOrder;
      return nextOrder;
    });
  }, [grouped]);

  useEffect(() => {
    persistCategoryOrder(categoryOrder);
  }, [categoryOrder]);

  const handleSetCategoryPopupOpen = useCallback((categoryName: string, state: SetStateAction<boolean>) => {
    setOpenCategoryId(prevId => {
      const prevIsOpen = prevId === categoryName;
      const nextIsOpen = typeof state === "function" ? state(prevIsOpen) : state;
      if (nextIsOpen) return categoryName;
      return prevIsOpen ? null : prevId;
    });
  }, []);

  const handleRenameCategory = useCallback(
    async (oldName: string, newName: string) => {
      const targets = orderedFunctions.filter(fn => fn.category === oldName);
      await Promise.all(
        targets.map(fn => changeFunctionCategory({functionId: fn._id!, category: newName}).unwrap())
      );
    },
    [orderedFunctions, changeFunctionCategory]
  );

  const handleDeleteCategory = useCallback(
    async (categoryName: string) => {
      const targets = orderedFunctions.filter(fn => fn.category === categoryName);
      await Promise.all(
        targets.map(fn => changeFunctionCategory({functionId: fn._id!, category: ""}).unwrap())
      );
    },
    [orderedFunctions, changeFunctionCategory]
  );

  const moveCategory = useCallback((fromIndex: number, toIndex: number) => {
    setCategoryOrder(prevOrder => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prevOrder.length ||
        toIndex > prevOrder.length
      ) {
        return prevOrder;
      }
      const nextOrder = [...prevOrder];
      const [moved] = nextOrder.splice(fromIndex, 1);
      if (!moved) return prevOrder;
      nextOrder.splice(toIndex, 0, moved);
      return nextOrder;
    });
  }, []);

  const orderedGrouped = useMemo(() => {
    if (!grouped.length) return [];
    const groupMap = new Map(grouped.map(g => [g.category, g]));
    const orderedFromStorage = categoryOrder
      .map(name => groupMap.get(name))
      .filter(Boolean) as CategoryGroup[];
    const remaining = grouped.filter(g => !categoryOrder.includes(g.category));
    return [...orderedFromStorage, ...remaining];
  }, [categoryOrder, grouped]);

  const moveFunction = useCallback((fromIndex: number, toIndex: number) => {
    setOrderedFunctions(prev => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return prev;
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
        if (currentIndex === -1) return next;
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

  const handleSetFunctionPopupOpen = useCallback((functionId: string, state: SetStateAction<boolean>) => {
    setOpenFunctionId(prevId => {
      const prevIsOpen = prevId === functionId;
      const nextIsOpen = typeof state === "function" ? state(prevIsOpen) : state;
      if (nextIsOpen) return functionId;
      return prevIsOpen ? null : prevId;
    });
  }, []);

  const handleNavigateToLogs = useCallback(() => {
    navigate("/function-logs");
  }, [navigate]);

  const handleNavigateToVariables = useCallback(() => {
    navigate("/function-variables");
  }, [navigate]);

  const renderFunctionItem = useCallback(
    (fn: SpicaFunction, index: number, groupKey: string) => (
      <SortableNavigationItem
        key={fn._id ?? index}
        id={fn._id!}
        title={fn.name}
        index={index}
        groupKey={groupKey}
        dndType={FUNCTION_ITEM_TYPE}
        iconName="function"
        moveItem={moveFunction}
        onNavigate={handleNavigateToFunction}
        onDragStart={handleDragStart}
        onDrop={handleDropFunction}
        itemClassName={functionNavigationStyles.functionItem}
        titleClassName={functionNavigationStyles.functionTitle}
        suffixClassName={functionNavigationStyles.actionButtons}
        renderSuffix={dragHandleRef => (
          <FlexElement gap={10}>
            <div ref={dragHandleRef}>
              <Button
                variant="icon"
                color="transparent"
                className={functionNavigationStyles.itemButton}
              >
                <Icon name="dragHorizontalVariant" size="sm" />
              </Button>
            </div>
            <FunctionNavigatorPopup
              className={functionNavigationStyles.itemButton}
              isOpen={openFunctionId === fn._id}
              setIsOpen={state => handleSetFunctionPopupOpen(fn._id!, state)}
              fn={fn}
            />
          </FlexElement>
        )}
      />
    ),
    [handleDragStart, handleDropFunction, handleNavigateToFunction, handleSetFunctionPopupOpen, moveFunction, openFunctionId]
  );

  const groupedAccordionItems = useMemo(
    () =>
      orderedGrouped.map((groupItem, groupIndex) => {
        const categoryName = helperUtils.capitalize(groupItem.category ?? "Uncategorized");

        return (
          <SortableCategoryItem
            key={groupItem.category ?? groupIndex}
            categoryKey={groupItem.category}
            index={groupIndex}
            moveCategory={moveCategory}
          >
            {({setDragHandleRef}) => (
              <Accordion
                items={[
                  {
                    title: categoryName,
                    content: (
                      <>
                        {groupItem.items.map(({fn, index}) =>
                          renderFunctionItem(fn, index, fn.category ?? UNGROUPED_CATEGORY_KEY)
                        )}
                      </>
                    ),
                    icon: (
                      <FlexElement gap={4}>
                        <div
                          ref={setDragHandleRef}
                          className={functionNavigationStyles.categoryDragHandle}
                        >
                          <Icon name="dragHorizontalVariant" />
                        </div>
                        <CategoryNavigatorPopup
                          categoryName={groupItem.category}
                          isOpen={openCategoryId === groupItem.category}
                          setIsOpen={state => handleSetCategoryPopupOpen(groupItem.category, state)}
                          onRename={newName => handleRenameCategory(groupItem.category, newName)}
                          onDelete={() => handleDeleteCategory(groupItem.category)}
                        />
                      </FlexElement>
                    )
                  }
                ]}
                defaultActiveIndex={-1}
                headerClassName={functionNavigationStyles.accordionHeader}
                className={functionNavigationStyles.accordion}
                openClassName={functionNavigationStyles.accordionOpen}
                gap={0}
              />
            )}
          </SortableCategoryItem>
        );
      }),
    [moveCategory, orderedGrouped, renderFunctionItem, openCategoryId, handleSetCategoryPopupOpen, handleRenameCategory, handleDeleteCategory]
  );

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
            <>
              <Button
                variant="icon"
                color="transparent"
                className={styles.button}
                onClick={handleNavigateToLogs}
              >
                <Icon name="bug" size="sm" />
              </Button>
              <Button
                variant="icon"
                color="transparent"
                className={styles.button}
                onClick={handleNavigateToVariables}
              >
                <Icon name="cog" size="sm" />
              </Button>
            </>
          )
        }}
      />
      <div className={functionNavigationStyles.functionsItemContainer}>
        {groupedAccordionItems}
        {ungrouped.map(({fn, index}) =>
          renderFunctionItem(fn, index, fn.category ?? UNGROUPED_CATEGORY_KEY)
        )}
      </div>
      <div className={styles.addFunctionButtonContainer}>
        <Button
          color="transparent"
          variant="text"
          fullWidth
          onClick={() => setIsModalOpen(true)}
          className={styles.addFunctionButton}
        >
          <Icon name="plus" size="sm" />
          Add New Function
        </Button>
      </div>

      <AddFunctionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleFunctionCreated}
      />
    </div>
  );
};

export default memo(FunctionNavigation);
