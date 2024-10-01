export class HttpException extends Error {
  status: number;
  constructor(exception: {status: number; message: string}) {
    super(exception.message);
    this.status = exception.status;
  }
}

export class BadRequestException extends HttpException {
  constructor(message: string) {
    super({status: 400, message});
  }
}

export class ACLSyntaxException extends BadRequestException {
  constructor(message: string) {
    super("ACL rule syntax error: " + message);
  }
}

export class DatabaseException extends BadRequestException {
  constructor(message: string) {
    super("Database error: " + message);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message: string) {
    super({status: 401, message});
  }
}
