import {Controller, Get, INestApplication, Req, UseGuards} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {AuthGuard, ActionGuard} from "@spica-server/passport/guard";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {StrategyType} from "@spica-server/passport/guard";

@Controller("test")
class TestController {
  @Get("1")
  @UseGuards(AuthGuard())
  test1(@Req() req) {
    return req.user;
  }

  @Get("2")
  @UseGuards(AuthGuard(), ActionGuard("test"))
  test2(@Req() req) {
    return [req.TESTING_SKIP_CHECK];
  }

  @Get("3")
  @UseGuards(AuthGuard())
  test3(@StrategyType() type) {
    return type;
  }
}

describe("Passport testing", () => {
  let req: Request;
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize({
          overriddenStrategyType: "INDISTINCT_STRATEGY_BUT_OKAY"
        }),
        CoreTestingModule
      ],
      controllers: [TestController]
    }).compile();
    req = module.get(Request);
    app = module.createNestApplication();
    await app.listen(req.socket);
  });

  afterEach(async () => {
    await app.close();
  });

  it("should bypass AuthGuard", async () => {
    const res = await req.get("/test/1", {});
    expect(res.body).toEqual({identifier: "noop", policies: []});
  });

  it("should bypass AuthGuard and ActionGuard", async () => {
    const res = await req.get("/test/2", {});
    expect(res.body).toEqual([true]);
  });

  it("should override strategy type", async () => {
    const res = await req.get("/test/3", {});
    expect(res.body).toBe("INDISTINCT_STRATEGY_BUT_OKAY");
  });
});
