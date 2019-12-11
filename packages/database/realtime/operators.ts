import {Observable, Operator, Subscriber, TeardownLogic} from "rxjs";

class LateSubscriber<T> implements Operator<T, T> {
  constructor(private callback: (subscriber: Subscriber<T>) => void) {}

  call(subscriber: Subscriber<T>, source: Observable<T>): TeardownLogic {
    this.callback(subscriber);
    return source.subscribe(subscriber);
  }
}

export function late<T>(callback: (subscriber: Subscriber<T>) => void) {
  return function lateOperatorFunction(source: Observable<T>) {
    return source.lift(new LateSubscriber(callback));
  };
}
