import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Param,
  UseGuards
} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {joinWildcardParam} from "@spica-server/core";
import {ActionGuard} from "@spica-server/passport-guard";
import {POLICY_RESOLVER} from "@spica-server/interface-passport-guard";
import {AddressInfo} from "net";

class FakeAuthentication implements CanActivate {
  canActivate(context: ExecutionContext) {
    context.switchToHttp().getRequest().user = {policies: ["restricted"]};
    return true;
  }
}

@Controller("storage")
class ProbeController {
  @Get("*id")
  @UseGuards(
    joinWildcardParam("id"),
    FakeAuthentication,
    ActionGuard("storage:show", "storage/:id")
  )
  show(@Param("id") id: string) {
    return {id};
  }
}

describe("ActionGuard on a wildcard route", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        {
          provide: POLICY_RESOLVER,
          useValue: async () => [
            {
              name: "restricted",
              statement: [
                {
                  action: "storage:show",
                  module: "storage",
                  resource: {include: ["*"], exclude: ["private*"]}
                }
              ]
            }
          ]
        }
      ]
    }).compile();

    app = module.createNestApplication();
    await app.listen(0, "127.0.0.1");
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterEach(() => app.close());

  it("should hand the nested name to the handler as one string", async () => {
    const response = await fetch(`${baseUrl}/storage/public/nested/file.txt`);

    expect(response.status).toEqual(200);
    expect(await response.json()).toEqual({id: "public/nested/file.txt"});
  });

  it("should keep the trailing slash of a folder name", async () => {
    const response = await fetch(`${baseUrl}/storage/public/folder/`);

    expect(await response.json()).toEqual({id: "public/folder/"});
  });

  it("should enforce an exclusion against the whole nested name", async () => {
    const response = await fetch(`${baseUrl}/storage/private/file.txt`);

    expect(response.status).toEqual(403);
  });
});
