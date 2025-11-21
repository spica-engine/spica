import {ExecutionContext, UnauthorizedException, UseGuards} from "@nestjs/common";
import {AuthGuard} from "@spica-server/passport/guard";
import passport from "passport";
import {Controller, Get, INestApplication, Post} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";

@Controller("test")
export class TestController {
  @Get("allow-all")
  @UseGuards(AuthGuard())
  allowAll() {
    return {message: "allow-all"};
  }

  @Get("allow-identity")
  @UseGuards(AuthGuard(["IDENTITY"]))
  allowIdentity() {
    return {message: "allow-identity"};
  }

  @Get("allow-user-apikey")
  @UseGuards(AuthGuard(["USER", "APIKEY"]))
  allowUserApikey() {
    return {message: "allow-user-apikey"};
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

  describe("Allow all strategies - no restrictions", () => {
    let restoreMock: () => void;

    beforeEach(() => {
      restoreMock = mockPassportAuthenticate();
    });

    afterEach(() => {
      restoreMock();
    });

    it("should allow USER, APIKEY, and IDENTITY strategies", async () => {
      const results = await Promise.all([
        req.get("/test/allow-all", undefined, {
          Authorization: "USER user_token_123"
        }),
        req.get("/test/allow-all", undefined, {
          Authorization: "APIKEY sk_1234567890"
        }),
        req.get("/test/allow-all", undefined, {
          Authorization: "IDENTITY id_1234567890"
        })
      ]);

      results.forEach(response => {
        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe("allow-all");
      });
    });
  });

  describe("Allow IDENTITY strategy only - only IDENTITY passes, USER and APIKEY fail", () => {
    let restoreMock: () => void;

    beforeEach(() => {
      restoreMock = mockPassportAuthenticate();
    });

    afterEach(() => {
      restoreMock();
    });

    it("should allow IDENTITY and reject USER and APIKEY strategies", async () => {
      const results = await Promise.all([
        req.get("/test/allow-identity", undefined, {
          Authorization: "IDENTITY id_1234567890"
        }),
        req.get("/test/allow-identity", undefined, {
          Authorization: "USER user_token_123"
        }),
        req.get("/test/allow-identity", undefined, {
          Authorization: "APIKEY sk_1234567890"
        })
      ]);

      const [identityResponse, userResponse, apikeyResponse] = results;

      expect(identityResponse.statusCode).toBe(200);
      expect(identityResponse.body.message).toBe("allow-identity");

      expect(userResponse.statusCode).toBe(401);
      expect(userResponse.body.message).toContain('Strategy "user" is not allowed');

      expect(apikeyResponse.statusCode).toBe(401);
      expect(apikeyResponse.body.message).toContain('Strategy "apikey" is not allowed');
    });
  });

  describe("Allow USER and APIKEY strategies - both pass, IDENTITY fails", () => {
    let restoreMock: () => void;

    beforeEach(() => {
      restoreMock = mockPassportAuthenticate();
    });

    afterEach(() => {
      restoreMock();
    });

    it("should allow USER and APIKEY and reject IDENTITY strategy", async () => {
      const results = await Promise.all([
        req.get("/test/allow-user-apikey", undefined, {
          Authorization: "USER user_token_123"
        }),
        req.get("/test/allow-user-apikey", undefined, {
          Authorization: "APIKEY sk_1234567890"
        }),
        req.get("/test/allow-user-apikey", undefined, {
          Authorization: "IDENTITY id_1234567890"
        })
      ]);

      const [userResponse, apikeyResponse, identityResponse] = results;

      expect(userResponse.statusCode).toBe(200);
      expect(userResponse.body.message).toBe("allow-user-apikey");

      expect(apikeyResponse.statusCode).toBe(200);
      expect(apikeyResponse.body.message).toBe("allow-user-apikey");

      expect(identityResponse.statusCode).toBe(401);
      expect(identityResponse.body.message).toContain('Strategy "identity" is not allowed');
    });
  });
});
