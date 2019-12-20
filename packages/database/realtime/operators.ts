import {Observable, Operator, Subscriber, Subscription, TeardownLogic} from "rxjs";

class LateSubscriber<T> implements Operator<T, T> {
  constructor(private callback: (subscriber: Subscriber<T>, connect: () => void) => void) {}

  call(subscriber: Subscriber<T>, source: Observable<T>): TeardownLogic {
    let subs: Subscription;
    let completed = false;
    this.callback(subscriber, () => {
      if (!completed) {
        subs = source.subscribe(subscriber);
      }
    });
    return () => {
      completed = true;
      if (subs) {
        subs.unsubscribe();
      }
    };
  }
}

export function late<T>(callback: (subscriber: Subscriber<T>, connect: () => void) => void) {
  return function lateOperatorFunction(source: Observable<T>) {
    return source.lift(new LateSubscriber(callback));
  };
}
