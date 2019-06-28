import {Inject, Injectable} from "@angular/core";
import {Observable} from "rxjs";
import * as socketio from "socket.io-client";

import {FUNCTION_OPTIONS, FunctionOptions} from "../../interface";

@Injectable({providedIn: "root"})
export class LanguageService {
  private socket: ReturnType<typeof socketio>;

  constructor(@Inject(FUNCTION_OPTIONS) options: FunctionOptions) {
    const url = new URL(options.url, window.location.origin);
    this.socket = socketio(`${url.origin}/functionlsp`, {
      transports: ["websocket"],
      path: url.pathname.replace(/\/$/, "") + "/socket.io"
    });
  }

  close() {
    this.socket.close();
  }

  open() {
    this.socket.connect();
  }

  request<T = {}>(event: string, ...args: any[]): Promise<T> {
    return new Promise(resolve => {
      args = args || [];
      if (args.length < 1) {
        args.push("");
      }
      args.push(resolve);
      this.notify(event, ...args);
    });
  }

  notify(event: string, ...args: any[]): void {
    this.socket.emit(event, ...args);
  }

  fromEvent<T>(event: string): Observable<T> {
    return new Observable<T>(observer => {
      const handler = (data: T) => observer.next(data);
      this.socket.on(event, handler);
      return () => this.socket.removeListener(event, handler);
    });
  }
}
