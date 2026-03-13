import type {FunctionLog} from "../../store/api/functionApi";

const FUNCTION_NAMES = [
  "sendNotification",
  "processPayment",
  "syncInventory",
  "validateOrder",
  "generateReport",
];

const FUNCTION_IDS = [
  "64a1b2c3d4e5f6a7b8c9d0e1",
  "64a1b2c3d4e5f6a7b8c9d0e2",
  "64a1b2c3d4e5f6a7b8c9d0e3",
  "64a1b2c3d4e5f6a7b8c9d0e4",
  "64a1b2c3d4e5f6a7b8c9d0e5",
];

const HANDLERS = ["onRequest", "onSchedule", "onDatabaseChange", "onFirehose", "default"];

const LOG_CONTENTS = [
  "Function executed successfully in 245ms",
  'Error: Cannot read property "id" of undefined',
  "Database connection timeout after 30000ms",
  "HTTP request received: POST /api/webhook",
  "Processing batch of 150 items",
  "Cache miss for key: user_session_abc123",
  "Scheduled task completed. Next run: 2026-03-14T00:00:00Z",
  "Warning: Rate limit approaching (85/100 requests)",
  "Authentication token refreshed successfully",
  "File upload processed: invoice_2026_03.pdf (2.4MB)",
  "Webhook payload validated and forwarded",
  'Query returned 0 results for filter: {"status":"active"}',
];

function objectIdFromTimestamp(ts: number): string {
  const hex = Math.floor(ts / 1000)
    .toString(16)
    .padStart(8, "0");
  const rand = Array.from({length: 16}, () => Math.floor(Math.random() * 16).toString(16)).join(
    ""
  );
  return hex + rand;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateMockLogs(count = 50, begin?: Date, end?: Date): FunctionLog[] {
  const now = end ?? new Date();
  const start = begin ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return Array.from({length: count}, (_, i) => {
    const ts = start.getTime() + Math.random() * (now.getTime() - start.getTime());
    const fnIndex = Math.floor(Math.random() * FUNCTION_IDS.length);
    const level = [0, 1, 1, 2, 2, 2, 3, 4][Math.floor(Math.random() * 8)];

    return {
      _id: objectIdFromTimestamp(ts),
      function: FUNCTION_IDS[fnIndex],
      event_id: `evt_${Date.now()}_${i}`,
      content: randomItem(LOG_CONTENTS),
      channel: (level >= 3 ? "stderr" : "stdout") as "stderr" | "stdout",
      created_at: new Date(ts).toISOString(),
      level,
    };
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export const MOCK_FUNCTION_MAP: Record<string, string> = Object.fromEntries(
  FUNCTION_IDS.map((id, i) => [id, FUNCTION_NAMES[i]])
);

export const MOCK_HANDLER_MAP: Record<string, string> = Object.fromEntries(
  FUNCTION_IDS.map((id, i) => [id, HANDLERS[i % HANDLERS.length]])
);

export const LEVEL_LABELS: Record<number, string> = {
  0: "Debug",
  1: "Log",
  2: "Info",
  3: "Warning",
  4: "Error",
};
