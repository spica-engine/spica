import {Inject, Injectable, NgZone} from "@angular/core";
import {Observable} from "rxjs";
import {takeUntil} from "rxjs/operators";
import * as io from "socket.io-client";

import {Page} from "./interface";
import {COMPOSER_OPTIONS, ComposerOptions} from "./options";

@Injectable({
  providedIn: "root",
  useFactory: provideComposerClient,
  deps: [[new Inject(COMPOSER_OPTIONS)], NgZone]
})
export class ComposerClient {
  get connect() {
    return this.fromEvent("connect");
  }

  get disconnect() {
    return this.fromEvent("disconnect");
  }

  get pages() {
    return this.fromEvent<Page[]>("page");
  }

  constructor(private socket: io.Socket) {}

  serve() {
    this.socket.emit("serve");
    return this.fromEvent<any>("progress").pipe(takeUntil(this.disconnect));
  }

  addPage(options: CreatePageOptions) {
    this.socket.emit("new page", options);
  }

  close() {
    this.socket.close();
  }

  emit(event: string, ...args: any[]) {
    this.socket.emit(event, ...args);
  }

  emitAck<T = {}>(event: string, ...args: any[]): Promise<T> {
    return new Promise(resolve => {
      args = args || [];
      if (args.length < 1) {
        args.push("");
      }
      args.push(resolve);
      this.emit(event, ...args);
    });
  }

  fromEvent<T>(event: string): Observable<T> {
    return new Observable<T>(observer => {
      const handler = (data: T) => observer.next(data);
      this.socket.on(event, handler);
      return () => this.socket.removeListener(event, handler);
    });
  }
}

export function provideComposerClient(options: ComposerOptions) {
  const url = new URL(options.url, window.location.origin);
  const client = io(`${url.origin}/composer`, {
    autoConnect: true,
    transports: ["websocket"],
    path: url.pathname.replace(/\/$/, "") + "/socket.io"
  });
  return new ComposerClient(client);
}

export enum ViewType {
  Element = 1, // When user come over element
  Container = 3 // When user come over an dynamic inserted view
}

export interface Ancestor {
  type: ViewType;
  index: string;
}

export interface TargetOptions {
  path: string;
  ancestors: Ancestor[];
}

export interface CreatePageOptions {
  name: string;
  route: string;
}
