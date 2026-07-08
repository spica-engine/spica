import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore
} from "react";

/*
 * Selection + edit model for the bucket-table primitive cells.
 *
 * The oziko `Table` no longer forwards cell focus or cell keyboard events, so
 * "which cell is selected / editing" is owned here instead of by the grid. The
 * state lives in a plain ref (an external store) and cells subscribe by their
 * own (rowId, columnKey) via `useSyncExternalStore`, reading a primitive
 * `0 | 1 | 2` snapshot. That keeps a selection change re-rendering ONLY the two
 * affected cells (old + new) rather than the whole grid.
 */

export interface CellCoord {
  rowId: string;
  columnKey: string;
}

export type MoveDirection = "up" | "down" | "left" | "right";

/**
 * Per-cell view of the selection model. Returned by useCellState(rowId, columnKey).
 * Re-renders the consuming cell ONLY when its own status (idle | selected | editing)
 * changes — implemented via useSyncExternalStore with a primitive snapshot.
 */
export interface CellStateApi {
  isSelected: boolean;                 // this cell is the selected cell
  isEditing: boolean;                  // this cell is the selected cell AND in edit mode
  isEditable: boolean;                 // grid-level: true iff onDataChange was provided
  editSeed: string | null;             // initial char when edit was started by typing; null when started by Enter/dbl-click; always null unless isEditing
  select: () => void;                  // select THIS cell (does not enter edit); no-op change if already selected
  requestEdit: (seed?: string) => void;// enter edit for THIS cell; no-op when !isEditable; toggle cells interpret this as "activate"
  exitEdit: () => void;                // leave edit mode, KEEP this cell selected (commit is the cell's responsibility, see §3)
  moveSelection: (dir: MoveDirection) => void; // move selection one step in the ordered grid; sets editing=false
}

export interface CellSelectionProviderProps {
  /** true iff BucketTable received an onDataChange prop; gates ALL edit entry. */
  editable: boolean;
  /** Visible property columns in display order, EXCLUDING "checkbox" and "_id". Drives left/right + Tab order. */
  orderedColumnKeys: string[];
  /** Row ids in display order (data.map(r => r._id)). Drives up/down order. */
  orderedRowIds: string[];
  /** The scrollable table container; provider attaches its keydown listener here (falls back to document). */
  containerRef: React.RefObject<HTMLElement>;
  children: React.ReactNode;
}

interface InternalState {
  selected: CellCoord | null;
  editing: boolean;
  editSeed: string | null;
}

interface CellSelectionContextValue {
  subscribe: (listener: () => void) => () => void;
  getCellSnapshot: (rowId: string, columnKey: string) => number;
  getEditSeed: () => string | null;
  editable: boolean;
  select: (coord: CellCoord) => void;
  requestEdit: (coord: CellCoord, seed?: string) => void;
  exitEdit: () => void;
  moveSelection: (dir: MoveDirection) => void;
}

const inertContext: CellSelectionContextValue = {
  subscribe: () => () => {},
  getCellSnapshot: () => 0,
  getEditSeed: () => null,
  editable: false,
  select: () => {},
  requestEdit: () => {},
  exitEdit: () => {},
  moveSelection: () => {}
};

const CellSelectionContext = createContext<CellSelectionContextValue>(inertContext);

// Extra px to clear the frozen columns / sticky header by after revealing a cell.
const REVEAL_GUTTER = 8;

/**
 * Bring the freshly-selected cell fully into view. Native `scrollIntoView` with
 * `nearest` follows right/down, but the oziko Table's sticky-left frozen columns
 * (checkbox, expand, _id) and its sticky `<thead>` overlap the scroll box's
 * top-left corner: a cell tucked UNDER them still counts as "visible", so moving
 * left/up never scrolled it clear. After the native call we detect that overlap
 * and nudge the real scroller (`.tableArea`) so the cell escapes the frozen band
 * on both axes. Kept synchronous/instant — no smooth scroll — to feel snappy.
 */
function revealSelectedCell(container: HTMLElement): void {
  const cell = container.querySelector<HTMLElement>('[class*="cellSelected"]');
  if (!cell) return;

  cell.scrollIntoView({block: "nearest", inline: "nearest"});

  const scroller = container.querySelector<HTMLElement>('[class*="tableArea"]') ?? container;
  const cellRect = cell.getBoundingClientRect();

  const row = cell.closest("tr");
  let frozenRight = scroller.getBoundingClientRect().left;
  if (row) {
    row.querySelectorAll<HTMLElement>('[class*="stickyCell"]').forEach(sticky => {
      if (sticky === cell) return;
      const r = sticky.getBoundingClientRect();
      if (r.left <= cellRect.left) frozenRight = Math.max(frozenRight, r.right);
    });
  }

  const header = scroller.querySelector<HTMLElement>("thead");
  const headerBottom = header
    ? header.getBoundingClientRect().bottom
    : scroller.getBoundingClientRect().top;

  const hiddenLeft = frozenRight - cellRect.left;
  if (hiddenLeft > 0) scroller.scrollLeft -= hiddenLeft + REVEAL_GUTTER;

  const hiddenTop = headerBottom - cellRect.top;
  if (hiddenTop > 0) scroller.scrollTop -= hiddenTop + REVEAL_GUTTER;
}

const isEditableTarget = (el: Element | null): boolean =>
  !!el &&
  (el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    (el as HTMLElement).isContentEditable);

export function useCellState(rowId: string, columnKey: string): CellStateApi {
  const ctx = useContext(CellSelectionContext);

  const snap = useSyncExternalStore(
    ctx.subscribe,
    () => ctx.getCellSnapshot(rowId, columnKey)
  );

  const isSelected = snap >= 1;
  const isEditing = snap === 2;
  const editSeed = snap === 2 ? ctx.getEditSeed() : null;

  const select = useCallback(() => {
    ctx.select({rowId, columnKey});
  }, [ctx, rowId, columnKey]);

  const requestEdit = useCallback(
    (seed?: string) => {
      ctx.requestEdit({rowId, columnKey}, seed);
    },
    [ctx, rowId, columnKey]
  );

  const exitEdit = useCallback(() => {
    ctx.exitEdit();
  }, [ctx]);

  const moveSelection = useCallback(
    (dir: MoveDirection) => {
      ctx.moveSelection(dir);
    },
    [ctx]
  );

  return {
    isSelected,
    isEditing,
    isEditable: ctx.editable,
    editSeed,
    select,
    requestEdit,
    exitEdit,
    moveSelection
  };
}

export const CellSelectionProvider: React.FC<CellSelectionProviderProps> = ({
  editable,
  orderedColumnKeys,
  orderedRowIds,
  containerRef,
  children
}) => {
  const stateRef = useRef<InternalState>({selected: null, editing: false, editSeed: null});
  const listenersRef = useRef<Set<() => void>>(new Set());

  // Latest props read by the imperative store methods without re-creating them.
  const editableRef = useRef(editable);
  const columnsRef = useRef(orderedColumnKeys);
  const rowsRef = useRef(orderedRowIds);
  editableRef.current = editable;
  columnsRef.current = orderedColumnKeys;
  rowsRef.current = orderedRowIds;

  const emit = useCallback(() => {
    listenersRef.current.forEach(l => l());
  }, []);

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getCellSnapshot = useCallback((rowId: string, columnKey: string) => {
    const s = stateRef.current;
    if (!s.selected || s.selected.rowId !== rowId || s.selected.columnKey !== columnKey) {
      return 0;
    }
    return s.editing ? 2 : 1;
  }, []);

  const getEditSeed = useCallback(() => stateRef.current.editSeed, []);

  const focusContainer = useCallback(() => {
    containerRef.current?.focus({preventScroll: true});
  }, [containerRef]);

  const select = useCallback(
    (coord: CellCoord) => {
      stateRef.current = {selected: coord, editing: false, editSeed: null};
      emit();
      // Pointer-driven selection: hand focus to the container so keyboard
      // navigation works right after a click — but never steal it from an
      // input the user is actively typing in.
      if (!isEditableTarget(document.activeElement)) {
        focusContainer();
      }
    },
    [emit, focusContainer]
  );

  const requestEdit = useCallback(
    (coord: CellCoord, seed?: string) => {
      if (!editableRef.current) return;
      stateRef.current = {selected: coord, editing: true, editSeed: seed ?? null};
      emit();
    },
    [emit]
  );

  const exitEdit = useCallback(() => {
    const s = stateRef.current;
    if (!s.editing && s.editSeed === null) {
      // Nothing to exit; still refocus so navigation resumes.
      focusContainer();
      return;
    }
    stateRef.current = {selected: s.selected, editing: false, editSeed: null};
    emit();
    focusContainer();
  }, [emit, focusContainer]);

  const clearSelection = useCallback(() => {
    if (!stateRef.current.selected) return;
    stateRef.current = {selected: null, editing: false, editSeed: null};
    emit();
  }, [emit]);

  const moveSelection = useCallback(
    (dir: MoveDirection) => {
      const s = stateRef.current;
      if (!s.selected) return;

      let {rowId, columnKey} = s.selected;

      if (dir === "left" || dir === "right") {
        const cols = columnsRef.current;
        const i = cols.indexOf(columnKey);
        if (i === -1) return;
        const next = dir === "left" ? i - 1 : i + 1;
        if (next < 0 || next >= cols.length) return; // clamp, no wrap
        columnKey = cols[next];
      } else {
        const rows = rowsRef.current;
        const i = rows.indexOf(rowId);
        if (i === -1) return;
        const next = dir === "up" ? i - 1 : i + 1;
        if (next < 0 || next >= rows.length) return; // clamp, no wrap
        rowId = rows[next];
      }

      stateRef.current = {selected: {rowId, columnKey}, editing: false, editSeed: null};
      emit();

      // Keep the newly-selected cell in view on both axes as it moves; wait one
      // frame so the cell has re-rendered with its `cellSelected` class.
      requestAnimationFrame(() => {
        const container = containerRef.current;
        if (container) revealSelectedCell(container);
      });
    },
    [emit, containerRef]
  );

  // Single keydown listener implementing the "selected, NOT editing" keyboard
  // map. Bails immediately while editing so the focused input owns its keys.
  useEffect(() => {
    const target: HTMLElement | Document = containerRef.current ?? document;

    if (containerRef.current && containerRef.current.tabIndex < 0) {
      containerRef.current.tabIndex = 0;
    }

    const onKeyDown = (event: Event) => {
      const e = event as KeyboardEvent;
      const s = stateRef.current;
      if (!s.selected || s.editing) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          moveSelection("up");
          return;
        case "ArrowDown":
          e.preventDefault();
          moveSelection("down");
          return;
        case "ArrowLeft":
          e.preventDefault();
          moveSelection("left");
          return;
        case "ArrowRight":
          e.preventDefault();
          moveSelection("right");
          return;
        case "Tab":
          e.preventDefault();
          moveSelection(e.shiftKey ? "left" : "right");
          return;
        case "Enter":
          e.preventDefault();
          requestEdit(s.selected);
          return;
        case " ":
        case "Spacebar":
          e.preventDefault();
          requestEdit(s.selected);
          return;
        case "Escape":
          e.preventDefault();
          clearSelection();
          return;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            requestEdit(s.selected, e.key);
          }
      }
    };

    target.addEventListener("keydown", onKeyDown);
    return () => target.removeEventListener("keydown", onKeyDown);
  }, [containerRef, moveSelection, requestEdit, clearSelection]);

  const contextValue = useMemo<CellSelectionContextValue>(
    () => ({
      subscribe,
      getCellSnapshot,
      getEditSeed,
      editable,
      select,
      requestEdit,
      exitEdit,
      moveSelection
    }),
    [subscribe, getCellSnapshot, getEditSeed, editable, select, requestEdit, exitEdit, moveSelection]
  );

  return (
    <CellSelectionContext.Provider value={contextValue}>{children}</CellSelectionContext.Provider>
  );
};
