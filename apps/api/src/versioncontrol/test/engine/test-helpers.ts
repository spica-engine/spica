import {Observable, Subscription} from "rxjs";
import {take, timeout} from "rxjs/operators";

/**
 * Helper utilities for flaky changeStream-based tests.
 * These utilities help manage timing issues and race conditions in tests
 * that rely on MongoDB changeStreams and async operations.
 */

/**
 * Waits for a condition to be true by polling with exponential backoff.
 * Useful for waiting for async operations to complete before proceeding.
 * 
 * @param condition - Function that returns true when condition is met
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 5000)
 * @param pollIntervalMs - Initial poll interval in milliseconds (default: 50)
 * @returns Promise that resolves when condition is true or rejects on timeout
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  pollIntervalMs: number = 50
): Promise<void> {
  const startTime = Date.now();
  let currentInterval = pollIntervalMs;

  while (Date.now() - startTime < timeoutMs) {
    const result = await Promise.resolve(condition());
    if (result) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, currentInterval));
    // Exponential backoff with max 500ms
    currentInterval = Math.min(currentInterval * 1.5, 500);
  }

  throw new Error(`Condition not met within ${timeoutMs}ms timeout`);
}

/**
 * Wraps an observable subscription with error handling for done() callbacks.
 * Ensures that test failures are properly reported and don't cause timeouts.
 * 
 * @param observable - The observable to subscribe to
 * @param handler - Handler function that receives the emitted value
 * @param done - Jest/Jasmine done callback
 * @param timeoutMs - Timeout for the subscription (default: 10000)
 * @returns Subscription object
 */
export function safeSubscribe<T>(
  observable: Observable<T>,
  handler: (value: T) => void | Promise<void>,
  done: jest.DoneCallback,
  timeoutMs: number = 10000
): Subscription {
  return observable
    .pipe(
      take(1), // Auto-unsubscribe after first emission
      timeout(timeoutMs)
    )
    .subscribe({
      next: async value => {
        try {
          await Promise.resolve(handler(value));
          done();
        } catch (error) {
          done(error);
        }
      },
      error: error => {
        // Handle timeout errors more gracefully
        if (error.name === "TimeoutError") {
          done(new Error(`Subscription timed out after ${timeoutMs}ms`));
        } else {
          done(error);
        }
      }
    });
}

/**
 * Adds a delay to allow subscriptions to be set up before triggering operations.
 * This helps prevent race conditions where events fire before subscriptions are ready.
 * 
 * @param ms - Delay in milliseconds (default: 100)
 * @returns Promise that resolves after the delay
 */
export async function delayForSubscriptionSetup(ms: number = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a promise that resolves when an observable emits a value matching a predicate.
 * Useful for converting observable-based tests to async/await style.
 * 
 * @param observable - The observable to watch
 * @param predicate - Optional predicate to filter values (default: always true)
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Promise that resolves with the first matching value
 */
export async function waitForObservable<T>(
  observable: Observable<T>,
  predicate?: (value: T) => boolean,
  timeoutMs: number = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      subscription.unsubscribe();
      reject(new Error(`Observable did not emit matching value within ${timeoutMs}ms`));
    }, timeoutMs);

    const subscription = observable.subscribe({
      next: value => {
        if (!predicate || predicate(value)) {
          clearTimeout(timeoutId);
          subscription.unsubscribe();
          resolve(value);
        }
      },
      error: error => {
        clearTimeout(timeoutId);
        subscription.unsubscribe();
        reject(error);
      }
    });
  });
}

/**
 * Wraps a test operation with multiple subscriptions and ensures proper cleanup.
 * Manages subscription lifecycle and provides error handling.
 * 
 * @param subscriptions - Array of subscription setup functions
 * @param operation - Operation to execute after subscriptions are set up
 * @param delayMs - Delay before executing operation (default: 100)
 */
export async function withSubscriptions<T>(
  subscriptions: Array<() => Subscription>,
  operation: () => T | Promise<T>,
  delayMs: number = 100
): Promise<T> {
  const subs: Subscription[] = [];
  
  try {
    // Set up all subscriptions
    for (const setupSub of subscriptions) {
      subs.push(setupSub());
    }

    // Wait for subscriptions to be ready
    await delayForSubscriptionSetup(delayMs);

    // Execute the operation
    return await Promise.resolve(operation());
  } finally {
    // Always clean up subscriptions
    subs.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
  }
}
