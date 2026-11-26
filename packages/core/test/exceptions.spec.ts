import {BadRequestException, Controller, Get, INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {serializeError} from "@spica-server/core";
import {AddressInfo} from "net";

class ExpiredError extends Error {
  expiredAt = "2026-01-01T00:00:00.000Z";

  constructor() {
    super();
    this.name = "ExpiredError";
    this.message = "token expired";
  }
}

@Controller()
class ProbeController {
  @Get("error")
  error() {
    throw new BadRequestException(serializeError(new ExpiredError()));
  }

  @Get("string")
  string() {
    throw new BadRequestException(serializeError("Token is disabled"));
  }
}

describe("serializeError", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({controllers: [ProbeController]}).compile();
    app = module.createNestApplication();
    await app.listen(0, "127.0.0.1");
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(() => app.close());

  it("should keep the fields of an error in the response body", async () => {
    const response = await fetch(`${baseUrl}/error`);

    expect(response.status).toEqual(400);
    expect(await response.json()).toEqual({
      name: "ExpiredError",
      message: "token expired",
      expiredAt: "2026-01-01T00:00:00.000Z"
    });
  });

  it("should leave other values as they are", async () => {
    const response = await fetch(`${baseUrl}/string`);

    expect(await response.json()).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: "Token is disabled"
    });
  });
});
