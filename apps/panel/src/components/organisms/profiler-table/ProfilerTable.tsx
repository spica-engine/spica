import React, {useMemo} from "react";
import {Button, FlexElement, Icon, Spinner, type TableColumn} from "oziko-ui-kit";
import SpicaTable from "../table/Table";
import type {ProfilerEntry} from "../../../store/api/userApi";
import pageStyles from "../../../pages/shared/EntityPage.module.scss";

const OP_COLORS: Record<string, string> = {
  insert: "#4caf50",
  query: "#2196f3",
  update: "#ff9800",
  remove: "#f44336",
  command: "#9c27b0",
  count: "#00bcd4",
  getMore: "#607d8b",
  default: "#9e9e9e",
};

export const OP_OPTIONS = [
  {label: "All", value: ""},
  {label: "Insert", value: "insert"},
  {label: "Query", value: "query"},
  {label: "Update", value: "update"},
  {label: "Remove", value: "remove"},
  {label: "Command", value: "command"},
  {label: "Count", value: "count"},
  {label: "Get More", value: "getMore"},
];

function extractQueryText(row: ProfilerEntry): string {
  const cmd = row.command;
  if (!cmd || Object.keys(cmd).length === 0) return "-";

  // named operation fields
  const opKeys = [
    "find", "aggregate", "update", "insert", "delete",
    "count", "findAndModify", "distinct", "mapReduce", "getMore",
  ] as const;
  for (const key of opKeys) {
    if (cmd[key] !== undefined) {
      const detail =
        cmd.filter ?? cmd.query ?? cmd.pipeline ?? cmd.updates ??
        cmd.deletes ?? cmd.documents ?? cmd.query ?? null;
      const detailStr = detail != null ? ` ${JSON.stringify(detail)}` : "";
      return `${key}${detailStr}`;
    }
  }

  // fallback: stringify the whole command
  return JSON.stringify(cmd);
}

function formatMillis(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

export type ProfilerTableProps = {
  title: string;
  subtitle: string;
  entries: ProfilerEntry[];
  isLoading: boolean;
  isFetching: boolean;
  skip: number;
  pageSize: number;
  opFilter: string;
  sortOrder: 1 | -1;
  onFilterChange: (value: string) => void;
  onToggleSort: () => void;
  onRefetch: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

const ProfilerTable = ({
  title,
  subtitle,
  entries,
  isLoading,
  isFetching,
  skip,
  pageSize,
  opFilter,
  sortOrder,
  onFilterChange,
  onToggleSort,
  onRefetch,
  onPrevPage,
  onNextPage,
}: ProfilerTableProps) => {
  const maxMillis = useMemo(
    () => entries.reduce((max, e) => (e.millis > max ? e.millis : max), 1),
    [entries]
  );

  const columns: TableColumn<ProfilerEntry>[] = [
    {
      header: <FlexElement>Query</FlexElement>,
      key: "op",
      width: "340px",
      minWidth: "220px",
      renderCell: ({row}) => (
        <FlexElement direction="horizontal" gap={8} alignment="leftCenter" style={{minWidth: 0}}>
          <span
            style={{
              flexShrink: 0,
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: "10px",
              background: OP_COLORS[row.op] ?? OP_COLORS.default,
              color: "#fff",
              fontWeight: 600,
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
            }}
          >
            {row.op}
          </span>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "12px",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              color: "var(--color-text-primary)",
            }}
            title={extractQueryText(row)}
          >
            {extractQueryText(row)}
          </span>
        </FlexElement>
      ),
    },
    {
      header: <FlexElement>Namespace</FlexElement>,
      key: "ns",
      width: "220px",
      minWidth: "160px",
      renderCell: ({row}) => (
        <span style={{fontFamily: "monospace", fontSize: "13px"}}>{row.ns}</span>
      ),
    },
    {
      header: (
        <FlexElement
          direction="horizontal"
          gap={4}
          alignment="leftCenter"
          style={{cursor: "pointer", userSelect: "none"}}
          onClick={onToggleSort}
        >
          Time consumed
          <Icon name={sortOrder === -1 ? "arrow_downward" : "arrow_upward"} size={14} />
        </FlexElement>
      ),
      key: "millis",
      width: "200px",
      minWidth: "160px",
      renderCell: ({row}) => {
        const pct = Math.min(100, (row.millis / maxMillis) * 100);
        const barColor =
          row.millis > 100 ? "#f44336" : row.millis > 20 ? "#ff9800" : "#2196f3";
        return (
          <div style={{width: "100%", minWidth: "120px"}}>
            <div
              style={{
                position: "relative",
                height: "22px",
                borderRadius: "4px",
                background: "var(--color-hover, rgba(255,255,255,0.06))",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  width: `${pct}%`,
                  background: barColor,
                  opacity: 0.25,
                  borderRadius: "4px",
                  transition: "width 0.3s ease",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: barColor,
                  whiteSpace: "nowrap",
                }}
              >
                {pct.toFixed(1)}% / {formatMillis(row.millis)}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      header: <FlexElement>Keys Examined</FlexElement>,
      key: "keysExamined",
      width: "140px",
      minWidth: "120px",
      renderCell: ({row}) => <span>{row.keysExamined ?? "-"}</span>,
    },
    {
      header: <FlexElement>Docs Examined</FlexElement>,
      key: "docsExamined",
      width: "140px",
      minWidth: "120px",
      renderCell: ({row}) => <span>{row.docsExamined ?? "-"}</span>,
    },
    {
      header: <FlexElement>Plan Summary</FlexElement>,
      key: "planSummary",
      width: "180px",
      minWidth: "150px",
      renderCell: ({row}) => (
        <span style={{fontFamily: "monospace", fontSize: "12px"}}>
          {row.planSummary ?? "-"}
        </span>
      ),
    },
    {
      header: <FlexElement>Client</FlexElement>,
      key: "client",
      width: "150px",
      minWidth: "120px",
      renderCell: ({row}) => <span>{row.client ?? "-"}</span>,
    },
    {
      header: <FlexElement>Timestamp</FlexElement>,
      key: "ts",
      width: "200px",
      minWidth: "160px",
      renderCell: ({row}) => (
        <span>
          {row.ts
            ? new Date(row.ts).toLocaleString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "-"}
        </span>
      ),
    },
  ];

  return (
    <div className={pageStyles.pageContainer}>
      <FlexElement direction="horizontal" style={{marginBottom: "16px"}}>
        <FlexElement direction="horizontal" gap={8} alignment="leftCenter">
          <Icon name="query_stats" size={22} />
          <span style={{fontSize: "18px", fontWeight: 600}}>{title}</span>
          <span style={{fontSize: "13px", color: "var(--color-text-secondary)"}}>{subtitle}</span>
        </FlexElement>
        <FlexElement direction="horizontal" gap={8} alignment="rightCenter">
          <select
            value={opFilter}
            onChange={e => onFilterChange(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: "14px",
            }}
          >
            {OP_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button variant="text" onClick={onRefetch} disabled={isFetching}>
            <Icon name="refresh" size={16} />
          </Button>
        </FlexElement>
      </FlexElement>

      {isLoading ? (
        <FlexElement alignment="center" style={{padding: "60px 0"}}>
          <Spinner />
        </FlexElement>
      ) : (
        <>
          <SpicaTable columns={columns} data={entries} />
          <FlexElement
            direction="horizontal"
            gap={8}
            alignment="spaceBetweenCenter"
            style={{marginTop: "16px"}}
          >
            <span style={{fontSize: "13px", color: "var(--color-text-secondary)"}}>
              Showing {skip + 1}&#x2013;{skip + entries.length} entries
            </span>
            <FlexElement direction="horizontal" gap={8}>
              <Button variant="secondary" disabled={skip === 0} onClick={onPrevPage}>
                <Icon name="chevron_left" size={16} />
                Prev
              </Button>
              <Button
                variant="secondary"
                disabled={entries.length < pageSize}
                onClick={onNextPage}
              >
                Next
                <Icon name="chevron_right" size={16} />
              </Button>
            </FlexElement>
          </FlexElement>
        </>
      )}
    </div>
  );
};

export default ProfilerTable;
