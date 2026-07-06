/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode
} from "react";
import {useNavigate, useLocation} from "react-router-dom";
import {Button, Icon, helperUtils} from "oziko-ui-kit";
import {useDrag, useDrop} from "react-dnd";
import type {Identifier} from "dnd-core";
import styles from "../Navigation.module.scss";
import functionNavigationStyles from "./FunctionNavigation.module.scss";
import {
  useGetFunctionsQuery,
  useUpdateFunctionOrderMutation,
  useDeleteFunctionMutation
} from "../../../../store/api";
import type {SpicaFunction} from "../../../../store/api/functionApi";
import SortableNavigationItem, {shouldPreventHover} from "../SortableNavigationItem";
import FunctionModal from "./FunctionModal";
import Confirmation from "../../../molecules/confirmation/Confirmation";

const FUNCTION_ITEM_TYPE = "FUNCTION_NAVIGATION_ITEM";
const CATEGORY_ITEM_TYPE = "FUNCTION_NAVIGATION_CATEGORY";
const CATEGORY_ORDER_STORAGE_KEY = "functionNavigationCategoryOrder";
const CATEGORY_COLLAPSE_STORAGE_KEY = "functionNavigationCollapsedCategories";
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
  a.length === b.length && a.every((item, index) => item === b[index]);

const safeReadCategoryOrder = (): string[] => {
  if (typeof globalThis === "undefined") {
    return [];
  }

  try {
    const storedValue = globalThis?.localStorage?.getItem(CATEGORY_ORDER_STORAGE_KEY);
    if (!storedValue) {
      return [];
    }

    const parsed = JSON.parse(storedValue);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const persistCategoryOrder = (order: string[]) => {
  if (typeof globalThis === "undefined") {
    return;
  }

  if (!order.length) {
    globalThis?.localStorage?.removeItem(CATEGORY_ORDER_STORAGE_KEY);
    return;
  }

  globalThis?.localStorage?.setItem(CATEGORY_ORDER_STORAGE_KEY, JSON.stringify(order));
};

const safeReadCollapsedCategories = (): Record<string, boolean> => {
  if (typeof globalThis === "undefined") {
    return {};
  }

  try {
    const storedValue = globalThis?.localStorage?.getItem(CATEGORY_COLLAPSE_STORAGE_KEY);
    if (!storedValue) {
      return {};
    }

    const parsed = JSON.parse(storedValue);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const persistCollapsedCategories = (collapsed: Record<string, boolean>) => {
  if (typeof globalThis === "undefined") {
    return;
  }

  const collapsedKeys = Object.keys(collapsed).filter(key => collapsed[key]);
  if (!collapsedKeys.length) {
    globalThis?.localStorage?.removeItem(CATEGORY_COLLAPSE_STORAGE_KEY);
    return;
  }

  globalThis?.localStorage?.setItem(CATEGORY_COLLAPSE_STORAGE_KEY, JSON.stringify(collapsed));
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
  categoryName: string;
  index: number;
  isCollapsed: boolean;
  onToggleCollapse: (key: string) => void;
  moveCategory: (fromIndex: number, toIndex: number) => void;
  children: ReactNode;
};

const SortableCategoryItem: FC<SortableCategoryItemProps> = ({
  categoryKey,
  categoryName,
  index,
  isCollapsed,
  onToggleCollapse,
  moveCategory,
  children
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [{handlerId}, drop] = useDrop<CategoryDragItem, void, {handlerId: Identifier | null}>({
    accept: CATEGORY_ITEM_TYPE,
    collect: monitor => ({
      handlerId: monitor.getHandlerId()
    }),
    hover: (item, monitor) => {
      const dragIndex = item.index;
      const hoverIndex = index;

      if (shouldPreventHover(containerRef, dragIndex, hoverIndex, monitor)) {
        return;
      }

      moveCategory(dragIndex, hoverIndex);
      item.index = hoverIndex;
    }
  });

  const [{isDragging}, drag, dragPreview] = useDrag(() => ({
    type: CATEGORY_ITEM_TYPE,
    item: {id: categoryKey, index, type: CATEGORY_ITEM_TYPE},
    collect: monitor => ({
      isDragging: monitor.isDragging()
    })
  }));

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (node) {
        drop(node);
        dragPreview(node);
      }
    },
    [drop, dragPreview]
  );

  const setDragHandleRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        drag(node);
      }
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
      <div
        className={functionNavigationStyles.catGroupHead}
        onClick={() => onToggleCollapse(categoryKey)}
      >
        <span
          className={`${functionNavigationStyles.catGroupChevron}${isCollapsed ? ` ${functionNavigationStyles.catGroupChevronCollapsed}` : ''}`}
        >
          <Icon name="chevronDown" size="sm" />
        </span>
        <span className={functionNavigationStyles.catGroupLabel}>{categoryName}</span>
        <div ref={setDragHandleRef} className={functionNavigationStyles.catGroupDrag}>
          <Icon name="grip" size="sm" />
        </div>
      </div>
      {!isCollapsed && (
        <div className={functionNavigationStyles.catGroupItems}>{children}</div>
      )}
    </div>
  );
};

const FunctionNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {data: functions} = useGetFunctionsQuery();
  const [updateFunctionOrder] = useUpdateFunctionOrderMutation();
  const [deleteFunction, {isLoading: isDeleting}] = useDeleteFunctionMutation();
  const [orderedFunctions, setOrderedFunctions] = useState<SpicaFunction[]>([]);
  const previousFunctionsRef = useRef<SpicaFunction[] | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingFunction, setDeletingFunction] = useState<SpicaFunction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(safeReadCollapsedCategories);

  const functionList = Array.isArray(functions) ? functions : functions?.data;

  const activeFunctionId = useMemo(() => {
    const match = location.pathname.match(/^\/function\/(.+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

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

  const filteredFunctions = useMemo(() => {
    if (!searchQuery.trim()) {
      return orderedFunctions;
    }

    const q = searchQuery.toLowerCase();
    return orderedFunctions.filter(fn => fn.name.toLowerCase().includes(q));
  }, [orderedFunctions, searchQuery]);

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

  const handleNavigateToVariables = useCallback(() => {
    navigate("/function-variables");
  }, [navigate]);

  useEffect(() => {
    const storedOrder = safeReadCategoryOrder();
    if (!storedOrder.length) {
      return;
    }

    setCategoryOrder(storedOrder);
  }, []);

  const handleToggleCategoryCollapse = useCallback((key: string) => {
    setCollapsedCategories(prev => ({...prev, [key]: !prev[key]}));
  }, []);

  useEffect(() => {
    persistCollapsedCategories(collapsedCategories);
  }, [collapsedCategories]);

  const {grouped} = useMemo(() => groupFunctionsByCategory(orderedFunctions), [orderedFunctions]);
  const {grouped: filteredGrouped, ungrouped: filteredUngrouped} = useMemo(
    () => groupFunctionsByCategory(filteredFunctions),
    [filteredFunctions]
  );

  useEffect(() => {
    setCategoryOrder(prevOrder => {
      const groupedNames = grouped.map(group => group.category);
      const filteredPrev = prevOrder.filter(name => groupedNames.includes(name));
      const missing = groupedNames.filter(name => !filteredPrev.includes(name));
      const nextOrder = [...filteredPrev, ...missing];

      if (arraysEqual(prevOrder, nextOrder)) {
        return prevOrder;
      }

      return nextOrder;
    });
  }, [grouped]);

  useEffect(() => {
    persistCategoryOrder(categoryOrder);
  }, [categoryOrder]);

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
      if (!moved) {
        return prevOrder;
      }
      nextOrder.splice(toIndex, 0, moved);
      return nextOrder;
    });
  }, []);

  const orderedGrouped = useMemo(() => {
    if (!filteredGrouped.length) {
      return [];
    }

    const groupMap = new Map(filteredGrouped.map(group => [group.category, group]));
    const orderedFromStorage = categoryOrder
      .map(categoryName => groupMap.get(categoryName))
      .filter(Boolean) as CategoryGroup[];
    const remainingGroups = filteredGrouped.filter(group => !categoryOrder.includes(group.category));

    return [...orderedFromStorage, ...remainingGroups];
  }, [categoryOrder, filteredGrouped]);

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
        variant="sidebar"
        isActive={activeFunctionId === fn._id}
        activeClassName={styles.navItemActive}
        moveItem={moveFunction}
        onNavigate={handleNavigateToFunction}
        onDragStart={handleDragStart}
        onDrop={handleDropFunction}
        itemClassName={styles.navItem}
        suffixClassName={styles.navItemActions}
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
                <Icon name="grip" size="sm" />
              </Button>
            </div>
          </>
        )}
      />
    ),
    [
      activeFunctionId,
      handleDeleteClick,
      handleDragStart,
      handleDropFunction,
      handleNavigateToFunction,
      moveFunction
    ]
  );

  const groupedCategoryItems = useMemo(
    () =>
      orderedGrouped.map((groupItem, groupIndex) => (
        <SortableCategoryItem
          key={groupItem.category ?? groupIndex}
          categoryKey={groupItem.category}
          categoryName={helperUtils.capitalize(groupItem.category)}
          index={groupIndex}
          isCollapsed={collapsedCategories[groupItem.category] ?? false}
          onToggleCollapse={handleToggleCategoryCollapse}
          moveCategory={moveCategory}
        >
          {groupItem.items.map(({fn, index}) =>
            renderFunctionItem(fn, index, fn.category ?? groupItem.category ?? UNGROUPED_CATEGORY_KEY)
          )}
        </SortableCategoryItem>
      )),
    [collapsedCategories, handleToggleCategoryCollapse, moveCategory, orderedGrouped, renderFunctionItem]
  );

  return (
    <div className={styles.container}>
      <div className={styles.sidebarHead}>
        <div className={styles.sidebarTopRow}>
          <span className={styles.sidebarLabel}>Functions</span>
          <div className={styles.sidebarActions}>
            <button
              className={styles.iconBtn}
              onClick={handleNavigateToLogs}
              title="Logs"
            >
              <Icon name="bug" size="sm" />
            </button>
            <button
              className={styles.iconBtn}
              onClick={handleNavigateToVariables}
              title="Variables"
            >
              <Icon name="cog" size="sm" />
            </button>
          </div>
        </div>
        <div className={styles.searchBox}>
          <Icon name="search" size="sm" />
          <input
            placeholder="Search functions…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <div className={functionNavigationStyles.functionNavigation}>
        {groupedCategoryItems}
        {filteredUngrouped.length > 0 && (
          <>
            {orderedGrouped.length > 0 && (
              <div className={functionNavigationStyles.uncategorizedLabel}>Uncategorized</div>
            )}
            {filteredUngrouped.map(({fn, index}) =>
              renderFunctionItem(fn, index, fn.category ?? UNGROUPED_CATEGORY_KEY)
            )}
          </>
        )}
      </div>
      <Button  className={styles.addButton} onClick={() => setIsModalOpen(true)}   color="transparent"
          variant="text">
        <Icon name="plus" size="sm" />
        Add New Function
      </Button>

      <FunctionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleFunctionCreated}
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
