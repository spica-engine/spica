import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {VersionControlController} from "../src/controller";
import {VersionManager} from "../src/interface";

describe("VersionControlController", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;
  let mockVersionManager: {
    availables: jest.Mock;
    exec: jest.Mock;
  };

  beforeEach(async () => {
    mockVersionManager = {
      availables: jest.fn().mockReturnValue(["add", "commit", "log", "push"]),
      exec: jest.fn().mockResolvedValue({success: true})
    };

    module = await Test.createTestingModule({
      imports: [CoreTestingModule, PassportTestingModule.initialize()],
      controllers: [VersionControlController],
      providers: [
        {
          provide: VersionManager,
          useValue: mockVersionManager
        }
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    await app.listen(req.socket);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("Errors", () => {
    it("should not leak error details when exec rejects with filesystem paths", async () => {
      const pathError = new Error(
        "Could not read from remote repository at /var/data/repos/.git/refs"
      );
      mockVersionManager.exec.mockRejectedValue(pathError);

      const response = await req.post("/versioncontrol/commands/push", {args: ["origin"]});
      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe("Command execution failed");
      expect(response.body.message).not.toContain("/var/data");
    });
  });
});
