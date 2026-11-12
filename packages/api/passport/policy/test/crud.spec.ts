import {NotFoundException} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {idOf, provideRepository, withId} from "@spica-server/data";
import {contractSuite} from "@spica-server/database-testing";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {POLICY_REPOSITORY} from "@spica-server/interface-passport-policy";
import * as CRUD from "../src/crud";
import {PolicyService} from "../src/policy.service";

contractSuite("policy crud replace", engine => {
  let module: TestingModule;
  let policies: PolicyService;

  const policy = (name: string) => ({
    name,
    description: `${name} policy`,
    statement: [{action: "bucket:index", module: "bucket", resource: {include: ["*"], exclude: []}}]
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: [provideRepository(POLICY_REPOSITORY), PolicyService]
    }).compile();
    await module.init();
    policies = module.get(PolicyService);
  });

  afterEach(() => module.close());

  it("should accept a replacement that changes nothing", async () => {
    const id = idOf(await CRUD.insert(policies, policy("a") as any));

    await expect(CRUD.replace(policies, withId(policy("a"), id) as any)).resolves.toBeTruthy();
  });

  it("should replace the policy", async () => {
    const id = idOf(await CRUD.insert(policies, policy("a") as any));

    await CRUD.replace(policies, withId(policy("renamed"), id) as any);

    expect(await policies.findById(id)).toMatchObject({name: "renamed"});
  });

  it("should answer 404 for a policy that does not exist", async () => {
    const missing = module.get<IdTypes>(ID_TYPES).forCollection("policies").generate();

    await expect(CRUD.replace(policies, withId(policy("a"), missing) as any)).rejects.toThrow(
      NotFoundException
    );
  });
});
