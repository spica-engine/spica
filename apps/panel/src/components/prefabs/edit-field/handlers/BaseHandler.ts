export class BaseHandler {
  next?: BaseHandler;

  setNext(handler: BaseHandler): BaseHandler {
    this.next = handler;
    return handler;
  }

  handle(request: any): any {
    if (this.next) {
      return this.next.handle(request);
    }
    return request;
  }
}

