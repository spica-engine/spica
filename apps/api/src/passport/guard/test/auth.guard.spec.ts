import {ExecutionContext, UnauthorizedException} from "@nestjs/common";
import {AuthGuard} from "@spica-server/passport/guard";
import passport from "passport";

describe("AuthGuard", () => {
  const mockAuthOptions = {
    defaultStrategy: "IDENTITY"
  };

  function createTestContext(authHeader?: string): ExecutionContext {
    const request = {
      headers: {
        authorization: authHeader
      },
      user: null
    };

    const response = {};

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response
      })
    } as ExecutionContext;
  }

  function mockPassportAuthenticate(user: any = {id: "test_user"}) {
    jest.spyOn(passport, "authenticate").mockImplementation((strategy, options, callback) => {
      return () => {
        callback(null, user, null);
      };
    });

    return () => {
      (passport.authenticate as jest.Mock).mockRestore();
    };
  }

  describe("forbiddenStrategies", () => {
    describe("with USER strategy forbidden", () => {
      let GuardClass: any;
      let restoreMock: () => void;

      beforeEach(() => {
        GuardClass = AuthGuard(["USER"]);
        restoreMock = mockPassportAuthenticate();
      });

      afterEach(() => {
        restoreMock();
      });

      it("should throw UnauthorizedException when USER strategy is used", async () => {
        const guard = new GuardClass(mockAuthOptions);
        const context = createTestContext("USER user_token_123");

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Strategy "user" is forbidden')
        );
      });

      it("should throw UnauthorizedException with case-insensitive match", async () => {
        const guard = new GuardClass(mockAuthOptions);
        const context = createTestContext("user user_token_123");

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Strategy "user" is forbidden')
        );
      });

      it("should successfully authenticate when APIKEY strategy is used", async () => {
        const guard = new GuardClass(mockAuthOptions);
        const context = createTestContext("APIKEY sk_1234567890");

        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      });

      it("should successfully authenticate when IDENTITY strategy is used", async () => {
        const guard = new GuardClass(mockAuthOptions);
        const context = createTestContext("IDENTITY id_1234567890");

        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      });
    });

    describe("with multiple forbidden strategies", () => {
      let GuardClass: any;
      let restoreMock: () => void;

      beforeEach(() => {
        GuardClass = AuthGuard(["USER", "APIKEY"]);
        restoreMock = mockPassportAuthenticate();
      });

      afterEach(() => {
        restoreMock();
      });

      it("should throw UnauthorizedException when USER strategy is used", async () => {
        const guard = new GuardClass(mockAuthOptions);
        const context = createTestContext("USER user_token_123");

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Strategy "user" is forbidden')
        );
      });

      it("should throw UnauthorizedException when APIKEY strategy is used", async () => {
        const guard = new GuardClass(mockAuthOptions);
        const context = createTestContext("APIKEY sk_1234567890");

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Strategy "apikey" is forbidden')
        );
      });

      it("should successfully authenticate when IDENTITY strategy is used", async () => {
        const guard = new GuardClass(mockAuthOptions);
        const context = createTestContext("IDENTITY id_1234567890");

        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      });
    });

    describe("without forbidden strategies", () => {
      let GuardClass: any;
      let restoreMock: () => void;

      beforeEach(() => {
        GuardClass = AuthGuard();
        restoreMock = mockPassportAuthenticate();
      });

      afterEach(() => {
        restoreMock();
      });

      it("should allow USER strategy when no forbidden strategies are defined", async () => {
        const guard = new GuardClass(mockAuthOptions);
        const context = createTestContext("USER user_token_123");

        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      });

      it("should allow APIKEY strategy when no forbidden strategies are defined", async () => {
        const guard = new GuardClass(mockAuthOptions);
        const context = createTestContext("APIKEY sk_1234567890");

        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      });

      it("should allow IDENTITY strategy when no forbidden strategies are defined", async () => {
        const guard = new GuardClass(mockAuthOptions);
        const context = createTestContext("IDENTITY id_1234567890");

        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      });
    });
  });
});
