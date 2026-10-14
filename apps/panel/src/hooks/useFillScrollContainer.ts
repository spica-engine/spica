import { useEffect, useLayoutEffect, useRef } from "react";

interface UseFillScrollContainerOptions {
  containerId: string;
  hasMore: boolean;
  isFetching: boolean;
  itemCount: number;
  onLoadMore: () => void;
}

export function useFillScrollContainer({
  containerId,
  hasMore,
  isFetching,
  itemCount,
  onLoadMore,
}: UseFillScrollContainerOptions) {
  const onLoadMoreRef = useRef(onLoadMore);
  useLayoutEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  });
  const lastRequestedItemCountRef = useRef<number | null>(null);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (itemCount === 0) lastRequestedItemCountRef.current = null;
    if (!container || !hasMore || isFetching || itemCount === 0) return;

    let requested = false;
    const loadMoreIfNotScrollable = () => {
      if (
        !requested &&
        lastRequestedItemCountRef.current !== itemCount &&
        container.scrollHeight <= container.clientHeight
      ) {
        requested = true;
        lastRequestedItemCountRef.current = itemCount;
        onLoadMoreRef.current();
      }
    };

    // Waiting a frame lets the rows of the page that just arrived be laid out before measuring.
    const frame = requestAnimationFrame(loadMoreIfNotScrollable);
    const resizeObserver = new ResizeObserver(loadMoreIfNotScrollable);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [containerId, hasMore, isFetching, itemCount]);
}
