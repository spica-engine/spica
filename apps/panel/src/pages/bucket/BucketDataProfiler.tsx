import React, { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button, FlexElement, Icon, Spinner, type TableColumn } from "oziko-ui-kit";
import SpicaTable from "../../components/organisms/table/Table";
import { useGetBucketDataProfileQuery } from "../../store/api/bucketApi";
import { useGetBucketsQuery } from "../../store/api/bucketApi";
import type { ProfilerEntry } from "../../store/api/userApi";
import styles from "../shared/EntityPage.module.scss";

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

const OP_OPTIONS = [
  { label: "All", value: "" },
  { label: "Insert", value: "insert" },
  { label: "Query", value: "query" },
  { label: "Update", value: "update" },
  { label: "Remove", value: "remove" },
  { label: "Command", value: "command" },
  { label: "Count", value: "count" },
  { label: "Get More", value: "getMore" },
];

const PAGE_SIZE = 20;

const BucketDataProfiler = () => {
  const { bucketId = "" } = useParams<{ bucketId: string }>();

  const [skip, setSkip] = useState(0);
  const [opFilter, setOpFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<1 | -1>(-1);

  const { data: buckets = [] } = useGetBucketsQuery();
  const bucket = buckets.find(b => b._id === bucketId);

  const queryParams = {
    bucketId,
    limit: PAGE_SIZE,
    skip,
    sort: { ts: sortOrder },
    ...(opFilter ? { filter: { op: opFilter } } : {}),
  };

  const {
    data: entries = [],
    isLoading,
    isFetching,
    refetch,
  } = useGetBucketDataProfileQuery(queryParams, { skip: !bucketId });

  const handleFilterChange = useCallback((value: string) => {
    setOpFilter(value);
    setSkip(0);
  }, []);

  const handleToggleSort = useCallback(() => {
    setSortOrder(prev => (prev === -1 ? 1 : -1));
    setSkip(0);
  }, []);

  const columns: TableColumn<ProfilerEntry>[] = [
    {
      header: <FlexElement>Op</FlexElement>,
      key: "op",
      width: "110px",
      minWidth: "100px",
      renderCell: ({ row }) => (
        <span
          style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: "12px",
            background: OP_COLORS[row.op] ?? OP_COLORS.default,
            color: "#fff",
            fontWeight: 600,
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {row.op}
        </span>
      ),
    },
    {
      header: <FlexElement>Namespace</FlexElement>,
      key: "ns",
      width: "260px",
      minWidth: "180px",
      renderCell: ({ row }) => (
        <span style={{ fontFamily: "monospace", fontSize: "13px" }}>{row.ns}</span>
      ),
    },
    {
      header: <FlexElement>Millis</FlexElement>,
      key: "millis",
      width: "90px",
      minWidth: "80px",
      renderCell: ({ row }) => (
        <span
          style={{
            color: row.millis > 100 ? "#f44336" : row.millis > 20 ? "#ff9800" : "#4caf50",
            fontWeight: 600,
          }}
        >
          {row.millis} ms
        </span>
      ),
    },
    {
      header: <FlexElement>Keys Examined</FlexElement>,
      key: "keysExamined",
      width: "140px",
      minWidth: "120px",
      renderCell: ({ row }) => <span>{row.keysExamined ?? "-"}</span>,
    },
    {
      header: <FlexElement>Docs Examined</FlexElement>,
      key: "docsExamined",
      width: "140px",
      minWidth: "120px",
      renderCell: ({ row }) => <span>{row.docsExamined ?? "-"}</span>,
    },
    {
      header: <FlexElement>Plan Summary</FlexElement>,
      key: "planSummary",
      width: "180px",
      minWidth: "150px",
      renderCell: ({ row }) => (
        <span style={{ fontFamily: "monospace", fontSize: "12px" }}>
          {row.planSummary ?? "-"}
        </span>
      ),
    },
    {
      header: <FlexElement>Client</FlexElement>,
      key: "client",
      width: "150px",
      minWidth: "120px",
      renderCell: ({ row }) => <span>{row.client ?? "-"}</span>,
    },
    {
      header: (
        <FlexElement
          direction="horizontal"
          gap={4}
          alignment="leftCenter"
          style={{ cursor: "pointer", userSelect: "none" }}
          onClick={handleToggleSort}
        >
          Timestamp
          <Icon name={sortOrder === -1 ? "arrow_downward" : "arrow_upward"} size={14} />
        </FlexElement>
      ),
      key: "ts",
      width: "200px",
      minWidth: "160px",
      renderCell: ({ row }) => (
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
    <div className={styles.pageContainer}>
      <FlexElement
        direction="horizontal"
        alignment="spaceBetweenCenter"
        style={{ marginBottom: "16px" }}
      >
        <FlexElement direction="horizontal" gap={8} alignment="leftCenter">
          <Icon name="query_stats" size={22} />
          <span style={{ fontSize: "18px", fontWeight: 600 }}>
            {bucket ? `${bucket.title} — Profiler` : "Bucket Data Profiler"}
          </span>
          {bucketId && (
            <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              — <code>bucket_{bucketId}</code>
            </span>
          )}
        </FlexElement>
        <FlexElement direction="horizontal" gap={8} alignment="rightCenter">
          <select
            value={opFilter}
            onChange={e => handleFilterChange(e.target.value)}
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
          <Button
            variant="secondary"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <Icon name="refresh" size={16} />
          </Button>
        </FlexElement>
      </FlexElement>

      {isLoading ? (
        <FlexElement alignment="center" style={{ padding: "60px 0" }}>
          <Spinner />
        </FlexElement>
      ) : (
        <>
          <SpicaTable columns={columns} data={entries} />
          <FlexElement
            direction="horizontal"
            gap={8}
            alignment="spaceBetweenCenter"
            style={{ marginTop: "16px" }}
          >
            <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Showing {skip + 1}–{skip + entries.length} entries
            </span>
            <FlexElement direction="horizontal" gap={8}>
              <Button
                variant="secondary"
                disabled={skip === 0}
                onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
              >
                <Icon name="chevron_left" size={16} />
                Prev
              </Button>
              <Button
                variant="secondary"
                disabled={entries.length < PAGE_SIZE}
                onClick={() => setSkip(skip + PAGE_SIZE)}
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

export default BucketDataProfiler;
