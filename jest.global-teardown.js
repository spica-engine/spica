/**
 * Stops the container `globalSetup` brought up. When CI supplied a ready server nothing was brought up and
 * there is nothing to do here either.
 */
export default async function globalTeardown() {
  const containers = [globalThis.__SPICA_PG_CONTAINER, globalThis.__SPICA_MONGO_CONTAINER];
  globalThis.__SPICA_PG_CONTAINER = undefined;
  globalThis.__SPICA_MONGO_CONTAINER = undefined;

  await Promise.all(containers.filter(Boolean).map(container => container.stop().catch(() => {})));
}
