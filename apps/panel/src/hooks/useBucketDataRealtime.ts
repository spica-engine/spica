import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {BucketDataQueryType} from "../store/api/bucketApi";
import type {UseBucketDataResult} from "./useBucketData";

const DEFAULT_PAGE_SIZE = 25;

// Mirrors @spica-server/interface-realtime ChunkKind. Duplicated here rather than
// imported so the panel doesn't take a cross-module dependency on the API package.
const enum ChunkKind {
  Error = -1,
  Initial = 0,
  EndOfInitial = 1,
  Insert = 2,
  Delete = 3,
  Expunge = 4,
  Update = 5,
  Replace = 6,
  Order = 7,
  Response = 8
}

const enum SequenceKind {
  Delete = 0,
  Substitute = 1,
  Insert = 2
}

interface Sequence {
  kind: SequenceKind;
  item: string;
  at: number;
  with?: string;
}

interface StreamChunk {
  kind: ChunkKind;
  document?: {_id: string; [key: string]: any};
  sequence?: Sequence[];
  status?: number;
  message?: string;
}

// Ordered, _id-keyed set — ports IterableSet from @spica-devkit/bucket so the
// panel applies realtime chunks (insert/update/delete/reorder) identically to
// the canonical client, without pulling in rxjs or the devkit.
class OrderedDocumentSet {
  private ids: string[] = [];
  private byId = new Map<string, any>();

  set(id: string, value: any): void {
    if (!this.byId.has(id)) {
      this.ids.push(id);
    }
    this.byId.set(id, value);
  }

  delete(id: string): void {
    const index = this.ids.indexOf(id);
    if (index !== -1) {
      this.ids.splice(index, 1);
    }
    this.byId.delete(id);
  }

  order(sequences: Sequence[] | undefined): void {
    if (!sequences) return;
    const deletedIds = new Set<string>();
    for (const sequence of sequences) {
      switch (sequence.kind) {
        case SequenceKind.Substitute:
          this.ids[sequence.at] = sequence.with as string;
          break;
        case SequenceKind.Insert:
          this.ids.splice(sequence.at, 0, sequence.item);
          break;
        case SequenceKind.Delete:
          this.ids.splice(sequence.at, 1);
          deletedIds.add(sequence.item);
          break;
      }
    }
    deletedIds.forEach(id => {
      if (this.ids.indexOf(id) === -1) {
        this.byId.delete(id);
      }
    });
  }

  toArray(): any[] {
    return this.ids.map(id => this.byId.get(id));
  }

  get size(): number {
    return this.ids.length;
  }
}

// VITE_BASE_URL is the HTTP API base (absolute, e.g. https://host/api). The WS
// endpoint lives at the same path over ws/wss. Fall back to window.location when
// the base is relative ("/api").
function buildWsBase(): string {
  const raw = (import.meta.env.VITE_BASE_URL as string) || "/api";
  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/^http/i, "ws");
  }
  if (typeof window === "undefined") return raw;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${protocol}//${window.location.host}${path}`;
}

// The token is stored raw (not JSON) under "token" — read it directly, never
// through useLocalStorage which would JSON.parse and crash on a bare JWT.
function readAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

function parseChunks(raw: string): StreamChunk[] {
  const chunks: StreamChunk[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      chunks.push(JSON.parse(trimmed) as StreamChunk);
    } catch {
      // Ignore malformed frames — a partial/garbage line must not kill the stream.
    }
  }
  return chunks;
}

export function useBucketDataRealtime(
  bucketId: string,
  searchQuery: BucketDataQueryType | undefined,
  enabled: boolean
): UseBucketDataResult {
  const resolvedBucketId =
    typeof bucketId === "string" &&
    bucketId.trim() !== "" &&
    bucketId !== "undefined" &&
    bucketId !== "null"
      ? bucketId
      : undefined;

  const pageSize = (searchQuery?.limit as number) ?? DEFAULT_PAGE_SIZE;

  const sortKey = useMemo(
    () => JSON.stringify(searchQuery?.sort ?? {_id: -1}),
    [searchQuery?.sort]
  );
  const filterKey = useMemo(
    () => (searchQuery?.filter ? JSON.stringify(searchQuery.filter) : ""),
    [searchQuery?.filter]
  );

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [limit, setLimit] = useState(pageSize);
  const [reconnectNonce, setReconnectNonce] = useState(0);

  const tableRef = useRef<HTMLElement | null>(null);
  const setRef = useRef(new OrderedDocumentSet());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialCountRef = useRef(0);

  // A fresh subscription always restarts pagination from the first page.
  useEffect(() => {
    setLimit(pageSize);
  }, [pageSize, sortKey, filterKey, resolvedBucketId]);

  useEffect(() => {
    if (!enabled || !resolvedBucketId) {
      setData([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    const token = readAuthToken();
    if (!token) {
      setData([]);
      setLoading(false);
      return;
    }

    const documents = new OrderedDocumentSet();
    setRef.current = documents;
    initialCountRef.current = 0;
    setLoading(true);

    const scheduleFlush = () => {
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        setData(documents.toArray());
      }, 1);
    };

    const params = new URLSearchParams();
    params.append("sort", sortKey);
    params.append("limit", String(limit));
    if (filterKey) params.append("filter", filterKey);
    // The gateway reads req.headers.authorization from this query param and
    // expects the full "IDENTITY <token>" scheme, matching the HTTP header.
    params.append("Authorization", `IDENTITY ${token}`);

    const url = `${buildWsBase()}/bucket/${resolvedBucketId}/data?${params.toString()}`;

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(url);
    } catch {
      setData([]);
      setLoading(false);
      setRefreshLoading(false);
      setIsFetchingMore(false);
      return;
    }

    const finishInitial = () => {
      initialCountRef.current = documents.size;
      setHasMore(documents.size >= limit);
      setLoading(false);
      setRefreshLoading(false);
      setIsFetchingMore(false);
      setData(documents.toArray());
    };

    socket.onmessage = event => {
      for (const chunk of parseChunks(String(event.data))) {
        switch (chunk.kind) {
          case ChunkKind.Initial:
          case ChunkKind.Insert:
          case ChunkKind.Update:
          case ChunkKind.Replace:
            if (chunk.document?._id) documents.set(chunk.document._id, chunk.document);
            scheduleFlush();
            break;
          case ChunkKind.Delete:
          case ChunkKind.Expunge:
            if (chunk.document?._id) documents.delete(chunk.document._id);
            scheduleFlush();
            break;
          case ChunkKind.Order:
            documents.order(chunk.sequence);
            scheduleFlush();
            break;
          case ChunkKind.EndOfInitial:
            finishInitial();
            break;
          case ChunkKind.Error:
            setLoading(false);
            setRefreshLoading(false);
            setIsFetchingMore(false);
            break;
          case ChunkKind.Response:
          default:
            break;
        }
      }
    };

    socket.onerror = () => {
      setLoading(false);
      setRefreshLoading(false);
      setIsFetchingMore(false);
    };

    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      socket?.close();
    };
  }, [enabled, resolvedBucketId, sortKey, filterKey, limit, reconnectNonce]);

  const bucketData = useMemo(() => {
    if (!enabled || !resolvedBucketId) return null;
    // meta.total is the live streamed document count — the WS protocol never
    // sends the true filtered collection total, so the footer reflects what is
    // currently on screen rather than the full server-side count.
    return {data, meta: {total: data.length}, bucketId: resolvedBucketId};
  }, [enabled, resolvedBucketId, data]);

  const loadMore = useCallback(() => {
    if (isFetchingMore || !hasMore) return;
    // Realtime has no cursor: raise the subscription ceiling and reconnect so the
    // stream re-primes with a larger initial page.
    setIsFetchingMore(true);
    setLimit(prev => prev + pageSize);
  }, [isFetchingMore, hasMore, pageSize]);

  const handleRefresh = useCallback(async () => {
    if (tableRef.current) {
      tableRef.current.scrollTo({top: 0, behavior: "smooth"});
    }
    setRefreshLoading(true);
    setReconnectNonce(prev => prev + 1);
  }, []);

  return {
    bucketData,
    bucketDataLoading: loading,
    refreshLoading,
    tableRef,
    handleRefresh,
    loadMore,
    hasMore,
    isFetchingMore
  };
}
