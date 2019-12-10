import {Controller, Get, INestApplication, UseGuards, Req} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {AuthGuard} from "../auth.guard";
import {ActionGuard} from "../policy";
import {PassportTestingModule} from "./module";

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
}

describe("Passport testing", () => {
  let req: Request;
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportTestingModule.initialize(), CoreTestingModule],
      controllers: [TestController]
    }).compile();
    req = module.get(Request);
    app = module.createNestApplication();
    await app.listenAsync(req.socket);
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
});
