export class Deferred<T> {
  private timer: any;

  constructor(private operation: string, timeout?: number) {
    this.timer = setTimeout(() => {
      this.reject(new Error(this.operation + " timeout"));
    }, timeout || 20000);
  }

  resolve: (value?: T) => void;
  reject: (err?: any) => void;

  promise = new Promise<T>((resolve, reject) => {
    this.resolve = obj => {
      clearTimeout(this.timer);
      resolve(obj);
    };
    this.reject = obj => {
      clearTimeout(this.timer);
      reject(obj);
    };
  });
}
