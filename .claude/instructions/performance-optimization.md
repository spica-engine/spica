# Performance Optimization Best Practices

> Apply these guidelines to all files across the codebase.

## General Principles

- **Measure First, Optimize Second:** Always profile and measure before optimizing. Use benchmarks, profilers, and monitoring tools to identify real bottlenecks. Guessing is the enemy of performance.
- **Optimize for the Common Case:** Focus on optimizing code paths that are most frequently executed.
- **Avoid Premature Optimization:** Write clear, maintainable code first; optimize only when necessary.
- **Minimize Resource Usage:** Use memory, CPU, network, and disk resources efficiently. Always ask: "Can this be done with less?"
- **Prefer Simplicity:** Simple algorithms and data structures are often faster and easier to optimize.
- **Automate Performance Testing:** Integrate performance tests and benchmarks into your CI/CD pipeline.
- **Set Performance Budgets:** Define acceptable limits for load time, memory usage, API latency, etc.

---

## Frontend Performance

### Rendering and DOM
- **Minimize DOM Manipulations:** Batch updates where possible.
- **Virtual DOM Frameworks:** Use React, Vue, or similar efficiently—avoid unnecessary re-renders.
  - Use `React.memo`, `useMemo`, and `useCallback` to prevent unnecessary renders.
- **Keys in Lists:** Always use stable keys in lists to help virtual DOM diffing.
- **Avoid Inline Styles:** Prefer CSS classes to avoid layout thrashing.
- **CSS Animations:** Use CSS transitions/animations over JavaScript for GPU-accelerated effects.

### Asset Optimization
- **Image Compression:** Prefer modern formats (WebP, AVIF). Use `loading="lazy"` for images.
- **Minification and Bundling:** Enable tree-shaking to remove dead code.
- **Cache Headers:** Set long-lived cache headers for static assets with cache busting.
- **Font Optimization:** Subset fonts and use `font-display: swap`.

### JavaScript Performance
- **Avoid Blocking the Main Thread:** Offload heavy computation to Web Workers.
- **Debounce/Throttle Events:** For scroll, resize, and input events.
- **Memory Leaks:** Clean up event listeners, intervals, and DOM references.
- **Efficient Data Structures:** Use Maps/Sets for lookups.

### Angular-Specific
- Use OnPush change detection for components that don't need frequent updates.
- Avoid complex expressions in templates; move logic to the component class.
- Use `trackBy` in `ngFor` for efficient list rendering.
- Lazy load modules and components with the Angular Router.

---

## Backend Performance

### Algorithm and Data Structure Optimization
- **Choose the Right Data Structure:** Arrays for sequential access, hash maps for fast lookups.
- **Avoid O(n²) or Worse:** Profile nested loops and recursive calls.
- **Batch Processing:** Process data in batches to reduce overhead (e.g., bulk database inserts).
- **Streaming:** Use streaming APIs for large data sets.

### Concurrency and Parallelism
- **Asynchronous I/O:** Use async/await to avoid blocking threads. Never use `fs.readFileSync` in production.
- **Bulk Operations:** Batch network/database calls to reduce round trips.

### Caching
- **Cache Expensive Computations:** Use in-memory caches (Redis, Memcached) for hot data.
- **Cache Invalidation:** Use TTL, event-based, or manual invalidation. Stale cache is worse than no cache.
- **Don't Cache Everything:** Some data is too volatile or sensitive to cache.

### API and Network
- **Minimize Payloads:** Compress responses (gzip, Brotli), avoid sending unnecessary data.
- **Pagination:** Always paginate large result sets. Use cursors for real-time data.
- **Connection Pooling:** Reuse connections for databases and external services.

---

## Database Performance

### Query Optimization
- **Indexes:** Use indexes on columns that are frequently queried, filtered, or joined.
- **Avoid SELECT *:** Select only the columns you need.
- **Avoid N+1 Queries:** Use joins or batch queries to avoid repeated queries in loops.
- **Limit Result Sets:** Use `LIMIT`/`OFFSET` or cursors for large tables.

### Schema Design
- **Data Types:** Use the most efficient data types and set appropriate constraints.
- **Partitioning:** Partition large tables for scalability and manageability.
- **Archiving:** Regularly archive or purge old data to keep tables small and fast.

### NoSQL (MongoDB)
- **Design for Access Patterns:** Model your data for the queries you need.
- **Avoid Hot Partitions:** Distribute writes/reads evenly.
- **Unbounded Growth:** Watch for unbounded arrays or documents.

---

## Code Review Checklist for Performance

- [ ] Are there any obvious algorithmic inefficiencies (O(n²) or worse)?
- [ ] Are data structures appropriate for their use?
- [ ] Is caching used where appropriate, and is invalidation handled correctly?
- [ ] Are database queries optimized, indexed, and free of N+1 issues?
- [ ] Are large payloads paginated, streamed, or chunked?
- [ ] Are there any memory leaks or unbounded resource usage?
- [ ] Are network requests minimized, batched, and retried on failure?
- [ ] Are there any blocking operations in hot paths?
- [ ] Is logging in hot paths minimized and structured?
- [ ] Are there automated tests or benchmarks for performance-sensitive code?
