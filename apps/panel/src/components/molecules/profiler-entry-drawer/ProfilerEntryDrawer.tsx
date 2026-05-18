import React from "react";
import {Drawer} from "oziko-ui-kit";
import type {ProfilerEntry} from "../../../store/api/userApi";
import styles from "./ProfilerEntryDrawer.module.scss";

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

function formatMillis(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type MetaRowProps = {label: string; value: React.ReactNode};

const MetaRow = ({label, value}: MetaRowProps) => (
  <div className={styles.metaRow}>
    <span className={styles.metaLabel}>{label}</span>
    <span className={styles.metaValue}>{value ?? "—"}</span>
  </div>
);

type Props = {
  entry: ProfilerEntry | null;
  onClose: () => void;
};

const ProfilerEntryDrawer = ({entry, onClose}: Props) => {
  const hasLocks = entry?.locks && Object.keys(entry.locks).length > 0;
  const hasAllUsers = entry?.allUsers && entry.allUsers.length > 0;

  return (
    <Drawer
      placement="right"
      size="md"
      isOpen={entry !== null}
      onClose={onClose}
      showCloseButton
      showBackdrop
    >
      {entry && (
        <div className={styles.drawerContent}>
          {/* Header */}
          <div className={styles.header}>
            <span
              className={styles.opBadge}
              style={{background: OP_COLORS[entry.op] ?? OP_COLORS.default}}
            >
              {entry.op}
            </span>
            <span className={styles.ns} title={entry.ns}>{entry.ns}</span>
          </div>

          {/* Timing */}
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Timing</span>
            <MetaRow label="Time Consumed" value={formatMillis(entry.millis)} />
            <MetaRow label="Num Yield" value={entry.numYield} />
            <MetaRow label="Timestamp" value={entry.ts ? formatTimestamp(entry.ts) : "—"} />
          </div>

          {/* Scan Statistics */}
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Scan Statistics</span>
            <MetaRow label="Keys Examined" value={entry.keysExamined} />
            <MetaRow label="Docs Examined" value={entry.docsExamined} />
            <MetaRow label="Plan Summary" value={entry.planSummary || "—"} />
          </div>

          {/* Client Info */}
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Client</span>
            <MetaRow label="Client" value={entry.client || "—"} />
            <MetaRow label="App Name" value={entry.appName || "—"} />
            <MetaRow label="User" value={entry.user || "—"} />
            {entry._id && <MetaRow label="ID" value={entry._id} />}
          </div>

          {/* Command */}
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Command</span>
            <pre className={styles.codeBlock}>
              {JSON.stringify(entry.command, null, 2)}
            </pre>
          </div>

          {/* Locks */}
          {hasLocks && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>Locks</span>
              <pre className={styles.codeBlock}>
                {JSON.stringify(entry.locks, null, 2)}
              </pre>
            </div>
          )}

          {/* All Users */}
          {hasAllUsers && (
            <div className={styles.section}>
              <span className={styles.sectionTitle}>All Users</span>
              <pre className={styles.codeBlock}>
                {JSON.stringify(entry.allUsers, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
};

export default ProfilerEntryDrawer;
