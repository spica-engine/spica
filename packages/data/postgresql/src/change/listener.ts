import {Logger} from "@nestjs/common";
import pg from "pg";
import {Subject} from "rxjs";
import {ChangeNotice, Coalescer, parseNotification} from "./coalescer.js";
import {CHANGE_CHANNEL} from "./sql.js";

const MAX_RETRY_DELAY_MS = 5000;

export class ChangeListener {
  readonly notices = new Subject<ChangeNotice>();
  readonly gaps = new Subject<void>();

  private readonly logger = new Logger(ChangeListener.name);
  private readonly coalescer = new Coalescer(notice => this.notices.next(notice));
  private client: pg.Client | undefined;
  private connecting: Promise<void> | undefined;
  private stopped = false;
  private lostOnce = false;
  private wake: (() => void) | undefined;
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly connectionString: string) {}

  start() {
    this.connecting ??= this.connect();
    return this.connecting;
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.wake?.();
    this.coalescer.close();
    const client = this.client;
    this.client = undefined;
    await client?.end().catch(() => undefined);
    await this.connecting;
  }

  private async connect() {
    for (let attempt = 0; !this.stopped; attempt++) {
      const client = new pg.Client({connectionString: this.connectionString});
      client.on("notification", message => {
        const notification = parseNotification(message.payload);
        if (notification) {
          this.coalescer.push(notification);
        }
      });
      client.on("error", error => this.lost(client, error));
      client.on("end", () => this.lost(client));
      try {
        await client.connect();
        await client.query(`LISTEN ${CHANGE_CHANNEL}`);
        if (this.stopped) {
          await client.end();
          return;
        }
        this.client = client;
        if (this.lostOnce) {
          this.gaps.next();
        }
        return;
      } catch (error) {
        client.removeAllListeners();
        client.on("error", () => undefined);
        await client.end().catch(() => undefined);
        this.logger.error(`Listening for changes failed: ${(error as Error).message}`);
        await this.sleep(Math.min(100 * 2 ** attempt, MAX_RETRY_DELAY_MS));
      }
    }
  }

  private lost(client: pg.Client, error?: Error) {
    if (client !== this.client || this.stopped) {
      return;
    }
    this.client = undefined;
    this.lostOnce = true;
    this.coalescer.flush();
    this.logger.warn(`The change listener lost its connection: ${error?.message ?? "closed"}`);
    this.connecting = this.connect();
  }

  private sleep(ms: number) {
    return new Promise<void>(resolve => {
      this.wake = resolve;
      this.timer = setTimeout(resolve, ms);
    });
  }
}
