import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "../../../../../libs/database/testing";
import {PassportTestingModule} from "../../passport/testing";
import {PreferenceModule} from "..";
import {CoreTestingModule, Request} from "../../../../../libs/core/testing";
import {IdentityModule} from "../../passport/identity";
import {INestApplication} from "@nestjs/common";
import {BucketModule, BucketCoreModule} from "../../bucket";
import {PolicyModule} from "../../passport/policy";
import {PreferenceService} from "../services";
import {SchemaModule} from "../../../../../libs/core/schema";
import {OBJECTID_STRING, DATE_TIME, OBJECT_ID} from "../../../../../libs/core/schema/formats";

describe("Preference Integration", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, OBJECTID_STRING, DATE_TIME]
        }),
        DatabaseTestingModule.replicaSet(),
        PassportTestingModule.initialize(),
        PreferenceModule.forRoot(),
        CoreTestingModule,
        //@ts-ignore
        IdentityModule.forRoot({
          secretOrKey: "key"
        }),
        PolicyModule.forRoot({realtime: false}),
        BucketModule.forRoot({
          hooks: false,
          history: false,
          realtime: false,
          cache: false,
          graphql: false
        }),
        BucketCoreModule
      ],
      providers: []
    }).compile();
    app = module.createNestApplication();
    req = module.get(Request);

    let prefService = module.get(PreferenceService);
    prefService.default({scope: "passport", identity: {attributes: {}}});

    await app.listen(req.socket);
  }, 120000);

  it("should update bucket document when language deleted", async () => {
    //insert bucket and data
    const bucket = {
      title: "bucket",
      description: "bucket",
      properties: {
        title: {
          type: "string",
          options: {
            translate: true
          }
        }
      }
    };
    const bucketId = await req.post("/bucket", bucket).then(res => res.body._id);

    const document = {
      title: {
        tr_TR: "yeni başlık",
        en_US: "new title"
      }
    };
    const documentId = await req
      .post(`/bucket/${bucketId}/data`, document)
      .then(res => res.body._id);

    await req.put("/preference/bucket", {
      scope: "bucket",
      language: {
        available: {en_US: "English"},
        default: "en_US"
      }
    });

    const {body} = await req.get(`/bucket/${bucketId}/data/${documentId}`, {localize: "false"});
    expect(body).toEqual({
      _id: documentId,
      title: {
        en_US: "new title"
      }
    });
  });

  it("should update identities when identity settings updated", async () => {
    await req.put("/preference/passport", {
      identity: {
        attributes: {
          properties: {
            name: {type: "string"}
          }
        }
      }
    });

    const identity = {
      attributes: {
        name: "test_name"
      },
      identifier: "test_user",
      password: "test_password"
    };
    const identityId = await req.post("/passport/identity", identity).then(r => r.body._id);

    await req.put("/preference/passport", {
      identity: {
        attributes: {
          properties: {}
        }
      }
    });

    const {body} = await req.get(`/passport/identity/${identityId}`);
    expect(body).toEqual({
      _id: identityId,
      identifier: "test_user",
      policies: [],
      attributes: {}
    });
  });
});
