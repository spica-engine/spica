export type NoticeOperation = "insert" | "update" | "delete";

export interface Notification {
  t: string;
  op: NoticeOperation;
  k: string;
  x: string;
  s: number;
  c?: string[];
  f?: string[];
  b?: Record<string, unknown>;
}

export interface ChangeNotice {
  id: string;
  table: string;
  operation: NoticeOperation;
  key: string;
  columns?: string[];
  fields?: string[];
  before?: Record<string, unknown>;
}

export function parseNotification(payload: string | undefined): Notification | undefined {
  try {
    const parsed = JSON.parse(payload ?? "");
    const valid =
      typeof parsed?.t == "string" &&
      typeof parsed.k == "string" &&
      typeof parsed.x == "string" &&
      typeof parsed.s == "number" &&
      ["insert", "update", "delete"].includes(parsed.op);
    return valid ? parsed : undefined;
  } catch {
    return undefined;
  }
}

const union = (first?: string[], second?: string[]) =>
  first || second ? [...new Set([...(first ?? []), ...(second ?? [])])] : undefined;

function merged(known: ChangeNotice, next: Notification): ChangeNotice | undefined {
  const details = {
    columns: union(known.columns, next.c),
    fields: union(known.fields, next.f),
    before: known.before ?? next.b
  };
  switch (`${known.operation}>${next.op}`) {
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
  id: `${notification.t}:${notification.s}`,
  table: notification.t,
  operation: notification.op,
  key: notification.k,
  ...(notification.c && {columns: notification.c}),
  ...(notification.f && {fields: notification.f}),
  ...(notification.b && {before: notification.b})
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
    if (this.transaction !== undefined && this.transaction != notification.x) {
      this.flush();
    }
    this.transaction = notification.x;

    const identity = `${notification.t}\0${notification.k}`;
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
