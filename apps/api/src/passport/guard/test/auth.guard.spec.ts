import {ExecutionContext, UnauthorizedException, UseGuards} from "@nestjs/common";
import {AuthGuard} from "@spica-server/passport/guard";
import passport from "passport";
import {Controller, Get, INestApplication, Post} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";

@Controller("test")
export class TestController {
  @Get("no-forbidden")
  @UseGuards(AuthGuard())
  noForbidden() {
    return {message: "no-forbidden"};
  }

  @Get("forbidden-user")
  @UseGuards(AuthGuard(["USER"]))
  forbiddenUser() {
    return {message: "forbidden-user"};
  }

  @Get("forbidden-user-apikey")
  @UseGuards(AuthGuard(["USER", "APIKEY"]))
  forbiddenUserApikey() {
    return {message: "forbidden-user-apikey"};
  }
}

describe("AuthGuard - Controller Tests", () => {
  let app: INestApplication;
  let req: Request;

  function mockPassportAuthenticate(user: any = {id: "test_user"}) {
    jest.spyOn(passport, "authenticate").mockImplementation((strategy, options, callback) => {
      return (req: any, res: any, next: any) => {
        req.user = user;
        callback(null, user, null);
      };
    });

    return () => {
      (passport.authenticate as jest.Mock).mockRestore();
    };
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [CoreTestingModule, PassportTestingModule.initialize()],
      controllers: [TestController]
    }).compile();

    req = module.get(Request);
    app = module.createNestApplication();
    await app.listen(req.socket);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("No forbidden strategies - all strategies allowed", () => {
    let restoreMock: () => void;

    beforeEach(() => {
      restoreMock = mockPassportAuthenticate();
    });

    afterEach(() => {
      restoreMock();
    });

    it("should allow USER strategy", async () => {
      const response = await req.get("/test/no-forbidden", undefined, {
        Authorization: "USER user_token_123"
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe("no-forbidden");
    });

    it("should allow APIKEY strategy", async () => {
      const response = await req.get("/test/no-forbidden", undefined, {
        Authorization: "APIKEY sk_1234567890"
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe("no-forbidden");
    });

    it("should allow IDENTITY strategy", async () => {
      const response = await req.get("/test/no-forbidden", undefined, {
        Authorization: "IDENTITY id_1234567890"
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe("no-forbidden");
    });
  });

  describe("One forbidden strategy (USER) - USER fails, APIKEY and IDENTITY pass", () => {
    let restoreMock: () => void;

    beforeEach(() => {
      restoreMock = mockPassportAuthenticate();
    });

    afterEach(() => {
      restoreMock();
    });

    it("should reject USER strategy with 401", async () => {
      const response = await req.get("/test/forbidden-user", undefined, {
        Authorization: "USER user_token_123"
      });

      expect(response.statusCode).toBe(401);
      expect(response.body.message).toContain('Strategy "user" is forbidden');
    });

    it("should allow APIKEY strategy", async () => {
      const response = await req.get("/test/forbidden-user", undefined, {
        Authorization: "APIKEY sk_1234567890"
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe("forbidden-user");
    });

    it("should allow IDENTITY strategy", async () => {
      const response = await req.get("/test/forbidden-user", undefined, {
        Authorization: "IDENTITY id_1234567890"
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe("forbidden-user");
    });
  });

  describe("Two forbidden strategies (USER, APIKEY) - both fail, IDENTITY passes", () => {
    let restoreMock: () => void;

    beforeEach(() => {
      restoreMock = mockPassportAuthenticate();
    });

    afterEach(() => {
      restoreMock();
    });

    it("should reject USER strategy with 401", async () => {
      const response = await req.get("/test/forbidden-user-apikey", undefined, {
        Authorization: "USER user_token_123"
      });

      expect(response.statusCode).toBe(401);
      expect(response.body.message).toContain('Strategy "user" is forbidden');
    });

    it("should reject APIKEY strategy with 401", async () => {
      const response = await req.get("/test/forbidden-user-apikey", undefined, {
        Authorization: "APIKEY sk_1234567890"
      });

      expect(response.statusCode).toBe(401);
      expect(response.body.message).toContain('Strategy "apikey" is forbidden');
    });

    it("should allow IDENTITY strategy", async () => {
      const response = await req.get("/test/forbidden-user-apikey", undefined, {
        Authorization: "IDENTITY id_1234567890"
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe("forbidden-user-apikey");
    });
  });
});
