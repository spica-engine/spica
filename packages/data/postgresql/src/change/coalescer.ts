export type NoticeOperation = "insert" | "update" | "delete";

export interface Notification {
  /** The table the changed row is reported for; child tables report their owner's table. */
  table: string;
  /** What happened to the row; child tables always report an update of their owner. */
  operation: NoticeOperation;
  /** The row's key as text; child tables report their owner's key. */
  key: string;
  /** The writing transaction, shared by all notifications of one commit. */
  transaction: string;
  /** Grows with every notification and is the same for every replica, so it identifies the change. */
  sequence: number;
  /** The columns whose value changed; only on updates, and left out when the payload is too large. */
  columns?: string[];
  /** The top-level fields a child table reports as changed. */
  fields?: string[];
  /** Chosen column values of the row before an update or delete, for tables that ask for them. */
  before?: Record<string, unknown>;
}

export interface ChangeNotice {
  /** The same on every replica for the same change. */
  id: string;
  table: string;
  operation: NoticeOperation;
  key: string;
  /** The columns that changed in any of the merged notifications. */
  columns?: string[];
  /** The top-level fields that changed in any of the merged notifications. */
  fields?: string[];
  /** The values the row had before the first merged notification. */
  before?: Record<string, unknown>;
}

export function parseNotification(payload: string | undefined): Notification | undefined {
  try {
    const parsed = JSON.parse(payload ?? "");
    const valid =
      typeof parsed?.table == "string" &&
      typeof parsed.key == "string" &&
      typeof parsed.transaction == "string" &&
      typeof parsed.sequence == "number" &&
      ["insert", "update", "delete"].includes(parsed.operation);
    return valid ? parsed : undefined;
  } catch {
    return undefined;
  }
}

const union = (first?: string[], second?: string[]) =>
  first || second ? [...new Set([...(first ?? []), ...(second ?? [])])] : undefined;

function merged(known: ChangeNotice, next: Notification): ChangeNotice | undefined {
  const details = {
    columns: union(known.columns, next.columns),
    fields: union(known.fields, next.fields),
    before: known.before ?? next.before
  };
  switch (`${known.operation}>${next.operation}`) {
    case "insert>delete":
      return undefined;
    case "delete>insert":
      return {...known, operation: "update", ...details};
    case "update>delete":
      return {...known, operation: "delete", ...details};
    case "insert>insert":
    case "insert>update":
      return {...known, ...details};
    case "update>insert":
    case "update>update":
      return {...known, operation: "update", ...details};
    default:
      return {...known, ...details};
  }
}

const noticeOf = (notification: Notification): ChangeNotice => ({
  id: `${notification.table}:${notification.sequence}`,
  table: notification.table,
  operation: notification.operation,
  key: notification.key,
  ...(notification.columns && {columns: notification.columns}),
  ...(notification.fields && {fields: notification.fields}),
  ...(notification.before && {before: notification.before})
});

export class Coalescer {
  private transaction: string | undefined;
  private pending = new Map<string, ChangeNotice>();
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly emit: (notice: ChangeNotice) => void,
    private readonly delayMs = 5
  ) {}

  push(notification: Notification) {
    if (this.transaction !== undefined && this.transaction != notification.transaction) {
      this.flush();
    }
    this.transaction = notification.transaction;

    const identity = `${notification.table}\0${notification.key}`;
    const known = this.pending.get(identity);
    if (!known) {
      this.pending.set(identity, noticeOf(notification));
    } else {
      const next = merged(known, notification);
      if (next) {
        this.pending.set(identity, next);
      } else {
        this.pending.delete(identity);
      }
    }

    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  flush() {
    clearTimeout(this.timer);
    this.timer = undefined;
    const notices = [...this.pending.values()];
    this.pending.clear();
    this.transaction = undefined;
    notices.forEach(this.emit);
  }

  close() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending.clear();
    this.transaction = undefined;
  }
}
