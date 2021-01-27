import {BadRequestException} from "@nestjs/common";

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
