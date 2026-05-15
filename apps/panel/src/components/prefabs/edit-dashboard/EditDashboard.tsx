import React, {useState, type FC, type ReactNode, useCallback} from "react";
import {Button, FlexElement, FluidContainer, Icon, Input, Modal, Text} from "oziko-ui-kit";
import type {Dashboard, DashboardComponent, DashboardComponentType} from "../../../store/api/dashboardApi";
import {
  DashboardRatio,
  useCreateDashboardMutation,
  useUpdateDashboardMutation,
  getEmptyComponent
} from "../../../store/api/dashboardApi";
import styles from "./EditDashboard.module.scss";

// ── Visual type definitions for create-mode type cards ──────────────────────
type VisualTypeKey = "Line" | "Bar" | "Area" | "Pie" | "Stat" | "Table";

interface VisualTypeOption {
  key: VisualTypeKey;
  label: string;
  apiType: DashboardComponentType;
}

const VISUAL_TYPES: VisualTypeOption[] = [
  {key: "Line", label: "Line", apiType: "line"},
  {key: "Bar", label: "Bar", apiType: "bar"},
  {key: "Area", label: "Area", apiType: "line"},
  {key: "Pie", label: "Pie", apiType: "pie"},
  {key: "Stat", label: "Stat", apiType: "statistic"},
  {key: "Table", label: "Table", apiType: "table"}
];

const CREATE_RATIO_OPTIONS: {label: string; value: DashboardRatio}[] = [
  {label: "1/1", value: DashboardRatio.OneByOne},
  {label: "1/2", value: DashboardRatio.OneByTwo},
  {label: "2/1", value: DashboardRatio.TwoByOne},
  {label: "2/2", value: DashboardRatio.TwoByTwo},
  {label: "4/2", value: DashboardRatio.FourByTwo}
];

function apiTypeToVisualKey(type: DashboardComponentType): VisualTypeKey {
  const map: Partial<Record<DashboardComponentType, VisualTypeKey>> = {
    line: "Line",
    bar: "Bar",
    pie: "Pie",
    statistic: "Stat",
    table: "Table"
  };
  return map[type] ?? "Line";
}

// ── Type card icons ──────────────────────────────────────────────────────────
const LineIcon = () => (
  <svg width="44" height="28" viewBox="0 0 44 28" fill="none" aria-hidden="true">
    <path d="M2,25 L10,17 L18,21 L26,9 L34,14 L42,4 L42,28 L2,28Z" fill="var(--color-accent-subtle)" />
    <path d="M2,25 L10,17 L18,21 L26,9 L34,14 L42,4" stroke="var(--color-accent)" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.35" />
    <path d="M2,25 L10,17 L18,21 L26,9 L34,14 L42,4" stroke="var(--color-accent)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <circle cx="26" cy="9" r="2.5" fill="var(--color-accent)" />
  </svg>
);

const BarIcon = () => (
  <div className={styles.miniBars} aria-hidden="true">
    <div className={styles.miniBar} style={{height: "12px"}} />
    <div className={`${styles.miniBar} ${styles.miniBarHi}`} style={{height: "24px"}} />
    <div className={styles.miniBar} style={{height: "16px"}} />
    <div className={styles.miniBar} style={{height: "20px"}} />
    <div className={`${styles.miniBar} ${styles.miniBarHi}`} style={{height: "28px"}} />
  </div>
);

const AreaIcon = () => (
  <svg width="44" height="28" viewBox="0 0 44 28" fill="none" aria-hidden="true">
    <path d="M2,24 L12,13 L20,19 L28,6 L36,11 L42,4 L42,28 L2,28Z" fill="var(--color-info)" opacity="0.15" />
    <path d="M2,24 L12,13 L20,19 L28,6 L36,11 L42,4" stroke="var(--color-info)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
  </svg>
);

const PieIcon = () => (
  <svg width="30" height="28" viewBox="0 0 30 28" fill="none" aria-hidden="true">
    <path d="M15,14 L15,2 A12,12 0 0,1 26.4,20 Z" fill="var(--color-accent-subtle)" />
    <path d="M15,14 L26.4,20 A12,12 0 0,1 2,20 Z" fill="var(--color-accent)" />
    <path d="M15,14 L2,20 A12,12 0 0,1 15,2 Z" fill="var(--color-border)" />
  </svg>
);

const StatIcon = () => (
  <div className={styles.statIcon} aria-hidden="true">
    <span className={styles.statNumber}>2.4M</span>
    <div className={styles.statBadge}>
      <div className={styles.statLine} />
      <span className={styles.statPercent}>+12%</span>
    </div>
  </div>
);

const TableIcon = () => (
  <svg width="38" height="28" viewBox="0 0 38 28" fill="none" aria-hidden="true">
    <rect x="0" y="0" width="38" height="9" rx="2.5" fill="var(--color-accent-subtle)" />
    <rect x="0" y="11" width="38" height="7" rx="2" fill="var(--color-border)" />
    <rect x="0" y="20" width="38" height="7" rx="2" fill="var(--color-border)" />
    <line x1="13" y1="0" x2="13" y2="9" stroke="var(--color-menu-background)" strokeWidth="1" />
    <line x1="26" y1="0" x2="26" y2="9" stroke="var(--color-menu-background)" strokeWidth="1" />
  </svg>
);

const TYPE_ICONS: Record<VisualTypeKey, React.ReactNode> = {
  Line: <LineIcon />,
  Bar: <BarIcon />,
  Area: <AreaIcon />,
  Pie: <PieIcon />,
  Stat: <StatIcon />,
  Table: <TableIcon />
};

// ── Props ────────────────────────────────────────────────────────────────────
type EditDashboardProps = {
  dashboard?: Dashboard;
  mode?: "edit" | "create";
  initialValue?: string;
  onCreated?: (dashboard: Dashboard) => void;
  children: (props: {
    isOpen: boolean;
    onOpen: (e: React.MouseEvent) => void;
    onClose: () => void;
  }) => ReactNode;
};

// ── Component ────────────────────────────────────────────────────────────────
const EditDashboard: FC<EditDashboardProps> = ({
  dashboard,
  mode = "edit",
  initialValue = "New Dashboard",
  onCreated,
  children
}) => {
  const [createDashboard] = useCreateDashboardMutation();
  const [updateDashboard] = useUpdateDashboardMutation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [value, setValue] = useState(dashboard?.name || initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const isCreateMode = mode === "create" || !dashboard;

  // Components array state
  const [components, setComponents] = useState<DashboardComponent[]>(() => {
    if (dashboard?.components?.length) return dashboard.components;
    if (!dashboard || mode === "create") return [getEmptyComponent()];
    return [];
  });

  // Visual type selection per component (parallel array to components)
  const [componentVisualTypes, setComponentVisualTypes] = useState<VisualTypeKey[]>(() => {
    const comps = dashboard?.components?.length
      ? dashboard.components
      : !dashboard || mode === "create"
        ? [getEmptyComponent()]
        : [];
    return comps.map(c => apiTypeToVisualKey(c.type));
  });

  // Collapsed state per component card
  const [collapsedCards, setCollapsedCards] = useState<Set<number>>(new Set());

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAddComponent = useCallback(() => {
    setComponents(prev => [...prev, getEmptyComponent()]);
    setComponentVisualTypes(prev => [...prev, "Line" as VisualTypeKey]);
  }, []);

  const handleRemoveComponent = useCallback(
    (index: number) => {
      if (components.length <= 1) return;
      setComponents(prev => prev.filter((_, i) => i !== index));
      setComponentVisualTypes(prev => prev.filter((_, i) => i !== index));
      setCollapsedCards(prev => {
        const next = new Set<number>();
        prev.forEach(i => {
          if (i < index) next.add(i);
          else if (i > index) next.add(i - 1);
        });
        return next;
      });
    },
    [components.length]
  );

  const handleComponentChange = useCallback(
    (index: number, field: keyof DashboardComponent, fieldValue: string) => {
      setComponents(prev =>
        prev.map((comp, i) => (i === index ? {...comp, [field]: fieldValue} : comp))
      );
    },
    []
  );

  const handleTypeCardSelect = useCallback(
    (index: number, visualKey: VisualTypeKey, apiType: DashboardComponentType) => {
      setComponentVisualTypes(prev => prev.map((vk, i) => (i === index ? visualKey : vk)));
      setComponents(prev =>
        prev.map((comp, i) => (i === index ? {...comp, type: apiType} : comp))
      );
    },
    []
  );

  const handleRatioSelect = useCallback(
    (index: number, ratio: DashboardRatio) => {
      setComponents(prev =>
        prev.map((comp, i) => (i === index ? {...comp, ratio} : comp))
      );
    },
    []
  );

  const toggleCardCollapse = useCallback((index: number) => {
    setCollapsedCards(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const resetCreateState = useCallback(() => {
    const resetComps = dashboard?.components?.length
      ? dashboard.components
      : !dashboard || mode === "create"
        ? [getEmptyComponent()]
        : [];
    setComponents(resetComps);
    setComponentVisualTypes(resetComps.map(c => apiTypeToVisualKey(c.type)));
    setCollapsedCards(new Set());
  }, [dashboard, mode]);

  const handleSave = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      if (!value.trim()) {
        setError("This field cannot be left empty.");
        return;
      }
      if (value.length < 3) {
        setError("This field must be at least 3 characters long");
        return;
      }
      if (value.length > 100) {
        setError("This field cannot exceed 100 characters");
        return;
      }

      if (isCreateMode) {
        const result = await createDashboard({
          name: value,
          icon: "dashboard",
          components
        }).unwrap();
        setIsModalOpen(false);
        onCreated?.(result);
      } else {
        await updateDashboard({
          id: dashboard!._id!,
          body: {name: value}
        }).unwrap();
        setIsModalOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [value, components, isCreateMode, createDashboard, updateDashboard, dashboard, onCreated]);

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    setValue(dashboard?.name || initialValue);
    resetCreateState();
    setError("");
  }, [dashboard?.name, initialValue, resetCreateState]);

  const handleOpen = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setValue(dashboard?.name || initialValue);
      resetCreateState();
      setIsModalOpen(true);
    },
    [dashboard?.name, initialValue, resetCreateState]
  );

  // ── Edit mode — simple name-only modal ───────────────────────────────────
  if (!isCreateMode) {
    return (
      <>
        {children({isOpen: isModalOpen, onOpen: handleOpen, onClose: handleClose})}
        {isModalOpen && (
          <Modal showCloseButton={false} onClose={handleClose} className={styles.modal} isOpen>
            <FluidContainer
              className={`${styles.container} ${error ? styles.containerWithError : ""}`}
              direction="vertical"
              gap={10}
              mode="fill"
              prefix={{
                children: (
                  <div className={styles.header}>
                    <Text className={styles.headerText}>EDIT NAME</Text>
                  </div>
                )
              }}
              root={{
                children: (
                  <div>
                    <FlexElement gap={5} className={styles.inputContainer}>
                      <Icon name="formatQuoteClose" size="md" />
                      <Input
                        className={styles.input}
                        onChange={e => setValue(e.target.value)}
                        placeholder="Name"
                        value={value}
                      />
                    </FlexElement>
                    {error && (
                      <Text variant="danger" className={styles.errorText}>
                        {error}
                      </Text>
                    )}
                  </div>
                )
              }}
              suffix={{
                dimensionX: "fill",
                alignment: "rightCenter",
                children: (
                  <FlexElement gap={10} className={styles.buttonsContainer}>
                    <div className={styles.addButtonWrapper}>
                      <Button
                        className={styles.addButton}
                        onClick={handleSave}
                        disabled={loading}
                        loading={loading}
                      >
                        <Icon name="save" />
                        <Text className={styles.addButtonText}>Save</Text>
                      </Button>
                    </div>
                    <Button
                      className={styles.cancelButton}
                      variant="text"
                      onClick={handleClose}
                      disabled={loading}
                    >
                      <Icon name="close" />
                      <Text>Cancel</Text>
                    </Button>
                  </FlexElement>
                )
              }}
            />
          </Modal>
        )}
      </>
    );
  }

  // ── Create mode — new dashboard creation popup ───────────────────────────
  return (
    <>
      {children({isOpen: isModalOpen, onOpen: handleOpen, onClose: handleClose})}
      {isModalOpen && (
        <Modal showCloseButton={false} onClose={handleClose} className={styles.createModal} isOpen>
          <div className={styles.createPopup}>

            {/* Dashboard name bar */}
            <div className={styles.nameBar}>
              <input
                className={styles.nameInput}
                type="text"
                placeholder="New Dashboard"
                value={value}
                onChange={e => setValue(e.target.value)}
              />
              {error && (
                <Text variant="danger" className={styles.nameError}>{error}</Text>
              )}
            </div>

            {/* Scrollable body */}
            <div className={styles.popupBody}>

              {/* Section divider */}
              <div className={styles.sectionDivider}>
                <div className={styles.sectionLine} />
                <span className={styles.sectionLabel}>Components</span>
                <span className={styles.sectionCount}>{components.length}</span>
                <div className={styles.sectionLine} />
              </div>

              {/* Component cards */}
              <div className={styles.compList}>
                {components.map((comp, index) => {
                  const isCollapsed = collapsedCards.has(index);
                  const visualKey = componentVisualTypes[index] ?? apiTypeToVisualKey(comp.type);
                  return (
                    <div
                      key={index}
                      className={`${styles.compCard} ${isCollapsed ? styles.compCardCollapsed : ""}`}
                    >
                      {/* Card header */}
                      <div className={styles.compHead} onClick={() => toggleCardCollapse(index)}>
                        <span className={styles.compNum}>{index + 1}</span>
                        <span className={styles.compNamePrev}>
                          {comp.name || "Unnamed Component"}
                        </span>
                        <span className={styles.compTypeBadge}>{visualKey}</span>
                        <span className={styles.compRatioBadge}>{comp.ratio}</span>
                        <svg
                          className={`${styles.compChevron} ${isCollapsed ? styles.compChevronCollapsed : ""}`}
                          width="13"
                          height="13"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          aria-hidden="true"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>

                      {/* Card body + footer — hidden when collapsed */}
                      {!isCollapsed && (
                        <>
                          <div className={styles.compBody}>
                            {/* Name + URL */}
                            <div className={styles.twoCol}>
                              <div className={styles.field}>
                                <label className={styles.fieldLbl}>Name *</label>
                                <input
                                  className={styles.fieldInput}
                                  type="text"
                                  placeholder="Component name"
                                  value={comp.name}
                                  onChange={e => handleComponentChange(index, "name", e.target.value)}
                                />
                              </div>
                              <div className={styles.field}>
                                <label className={styles.fieldLbl}>URL *</label>
                                <input
                                  className={styles.fieldInput}
                                  type="text"
                                  placeholder="https://api.example.com/data"
                                  value={comp.url}
                                  onChange={e => handleComponentChange(index, "url", e.target.value)}
                                />
                                <span className={styles.fieldHint}>
                                  Must return chart-compatible JSON.
                                </span>
                              </div>
                            </div>

                            {/* Type cards */}
                            <div className={styles.field}>
                              <label className={styles.fieldLbl}>Type</label>
                              <div className={styles.typeGrid}>
                                {VISUAL_TYPES.map(vt => {
                                  const isSelected = visualKey === vt.key;
                                  return (
                                    <div
                                      key={vt.key}
                                      className={`${styles.typeCard} ${isSelected ? styles.typeCardSel : ""}`}
                                      onClick={() => handleTypeCardSelect(index, vt.key, vt.apiType)}
                                    >
                                      {isSelected && (
                                        <div className={styles.typeCardDot}>
                                          <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="3.5" aria-hidden="true">
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                        </div>
                                      )}
                                      <div className={styles.typeCardIcon}>
                                        {TYPE_ICONS[vt.key]}
                                      </div>
                                      <span className={styles.typeCardLbl}>{vt.label}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Ratio pills */}
                            <div className={styles.field}>
                              <label className={styles.fieldLbl}>Aspect Ratio</label>
                              <div className={styles.ratioPills}>
                                {CREATE_RATIO_OPTIONS.map(ro => (
                                  <div
                                    key={ro.value}
                                    className={`${styles.ratioPill} ${comp.ratio === ro.value ? styles.ratioPillSel : ""}`}
                                    onClick={() => handleRatioSelect(index, ro.value)}
                                  >
                                    {ro.label}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Card footer */}
                          <div className={styles.compFoot}>
                            <button
                              type="button"
                              className={styles.deleteBtn}
                              onClick={() => handleRemoveComponent(index)}
                              disabled={components.length <= 1}
                            >
                              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add component button */}
              <button type="button" className={styles.addCompBtn} onClick={handleAddComponent}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add New Component
              </button>
            </div>

            {/* Footer */}
            <div className={styles.createFooter}>
              <Button onClick={handleSave} disabled={loading} loading={loading}>
                <Icon name="save" size="sm" />
                <Text className={styles.saveButtonText}>Save</Text>
              </Button>
            </div>

          </div>
        </Modal>
      )}
    </>
  );
};

export default EditDashboard;
